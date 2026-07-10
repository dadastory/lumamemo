import type { ConsolaInstance } from 'consola'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'path'
import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
import { exiftool } from 'exiftool-vendored'
import type {
  NewPipelineQueueItem,
  PipelineQueueItem,
  Photo,
} from '~~/server/utils/db'
import type { PhotoAiAnalysisStage } from '~~/shared/types/photo'
import { compressUint8Array } from '~~/shared/utils/u8array'
import {
  preprocessImageWithJpegUpload,
  processImageMetadataAndSharp,
} from '../image/processor'
import { generateImageVariantsAndHash } from '../image/variants'
import { extractExifData, extractPhotoInfo } from '../image/exif'
import {
  extractLocationFromGPS,
  parseGPSCoordinates,
} from '../location/geocoding'
import {
  clusterFacesForOwner,
  indexPhotoAiAnalysis,
  indexPhotoAutoTags,
  indexPhotoFaces,
  indexPhotoSemanticEmbedding,
} from '../ml/photo-indexer'
import { getVectorStore } from '../ml/vector-store'
import { settingsManager } from '../settings/settingsManager'
import { findLivePhotoVideoForImage } from '../video/livephoto'
import { processMotionPhotoFromXmp } from '../video/motion-photo'
import { getStorageManager } from '~~/server/plugins/3.storage'
import {
  isSameUserId,
  isStorageKeyInUserNamespace,
} from '~~/server/utils/security'
import { getPhotoDisplayStorageKey } from '~~/server/utils/raw-photo'

const EXIF_LOCATION_KEYS = [
  'GPSAltitude',
  'GPSAltitudeRef',
  'GPSLatitude',
  'GPSLatitudeRef',
  'GPSLongitude',
  'GPSLongitudeRef',
  'GPSPosition',
  'GPSDateStamp',
  'GPSTimeStamp',
  'GPSImgDirection',
  'GPSImgDirectionRef',
  'GPSDestBearing',
  'GPSDestBearingRef',
] as const

const stripLocationFromExif = <
  T extends Record<string, any> | null | undefined,
>(
  exif: T,
): T => {
  if (!exif || typeof exif !== 'object') {
    return exif
  }

  const cloned = { ...exif }
  for (const key of EXIF_LOCATION_KEYS) {
    delete cloned[key]
  }

  return cloned as T
}

export class QueueManager {
  private static instances: Map<string, QueueManager> = new Map()
  private workerId: string
  private logger: ConsolaInstance
  private isProcessing: boolean = false
  private processingInterval: NodeJS.Timeout | null = null
  private processedCount: number = 0
  private errorCount: number = 0
  private startTime: Date

  static getInstance(
    workerId: string = 'default',
    logger?: ConsolaInstance,
  ): QueueManager {
    if (!QueueManager.instances.has(workerId)) {
      QueueManager.instances.set(workerId, new QueueManager(workerId, logger))
    }
    return QueueManager.instances.get(workerId)!
  }

  static getAllInstances(): QueueManager[] {
    return Array.from(QueueManager.instances.values())
  }

  private constructor(workerId: string, _logger?: ConsolaInstance) {
    this.workerId = workerId
    this.logger = _logger
      ? _logger.withTag(`${workerId}`)
      : logger.dynamic(`queue-${workerId}`)
    this.startTime = new Date()
  }

  getWorkerId(): string {
    return this.workerId
  }

  getStats() {
    const uptime = Date.now() - this.startTime.getTime()
    return {
      workerId: this.workerId,
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      uptime: Math.floor(uptime / 1000), // seconds
      successRate:
        this.processedCount > 0
          ? (this.processedCount / (this.processedCount + this.errorCount)) *
            100
          : 0,
    }
  }

  /**
   * 插入新任务到队列
   * @param payload 任务负荷
   * @param options 可选的任务设置
   * @returns 新创建任务的 ID
   */
  async addTask(
    payload: any,
    options?: Partial<NewPipelineQueueItem>,
  ): Promise<number> {
    if (payload?.type === 'photo-face-cluster') {
      const existingClusterTaskId = await this.findPendingFaceClusterTask(
        payload.ownerUserId,
      )
      if (existingClusterTaskId) return existingClusterTaskId
    }

    const db = useDB()
    const result = await db
      .insert(tables.pipelineQueue)
      .values({
        payload,
        ...options,
      })
      .returning({ id: tables.pipelineQueue.id })
      .get()
    return result.id
  }

  async enqueueMachineLearningIndexTask(
    photoId: string,
    ownerUserId?: number | null,
  ) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    if (!mlEnabled) return null

    return await this.addTask(
      {
        type: 'photo-ml-index',
        photoId,
        ownerUserId,
      },
      {
        priority: 1,
        maxAttempts: 3,
      },
    )
  }

  async enqueueMachineLearningAutoTagTask(
    photoId: string,
    ownerUserId?: number | null,
  ) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    const enabled =
      (await settingsManager.get<boolean>('system', 'ml.autoTag.enabled')) ??
      true
    if (!mlEnabled || !enabled) return null

    return await this.addTask(
      {
        type: 'photo-ml-auto-tags',
        photoId,
        ownerUserId,
      },
      {
        priority: 1,
        maxAttempts: 3,
      },
    )
  }

  async enqueueMachineLearningSemanticEmbeddingTask(
    photoId: string,
    ownerUserId?: number | null,
  ) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    const enabled =
      (await settingsManager.get<boolean>(
        'system',
        'ml.semanticSearch.enabled',
      )) ?? true
    if (!mlEnabled || !enabled) return null

    return await this.addTask(
      {
        type: 'photo-ml-semantic-embedding',
        photoId,
        ownerUserId,
      },
      {
        priority: 1,
        maxAttempts: 3,
      },
    )
  }

  async enqueuePhotoAiAnalysisTask(
    photoId: string,
    ownerUserId?: number | null,
    stages?: PhotoAiAnalysisStage[],
  ) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    const enabled =
      (await settingsManager.get<boolean>('system', 'ml.aiDescription.enabled')) ??
      false
    if (!mlEnabled || !enabled) return null

    return await this.addTask(
      {
        type: 'photo-ai-analysis',
        photoId,
        ownerUserId,
        ...(stages && stages.length > 0 ? { stages } : {}),
      },
      {
        priority: 1,
        maxAttempts: 3,
      },
    )
  }

  async enqueuePhotoAiDescriptionTask(
    photoId: string,
    ownerUserId?: number | null,
  ) {
    return await this.enqueuePhotoAiAnalysisTask(photoId, ownerUserId, [
      'description',
    ])
  }

  async enqueueFaceDetectTask(photoId: string, ownerUserId?: number | null) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    const faceAlbumEnabled =
      (await settingsManager.get<boolean>('system', 'ml.faceAlbum.enabled')) ??
      false
    if (!mlEnabled || !faceAlbumEnabled) return null

    return await this.addTask(
      {
        type: 'photo-face-detect',
        photoId,
        ownerUserId,
      },
      {
        priority: 1,
        maxAttempts: 3,
      },
    )
  }

  async enqueueFaceClusterTask(ownerUserId?: number | null) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    const faceAlbumEnabled =
      (await settingsManager.get<boolean>('system', 'ml.faceAlbum.enabled')) ??
      false
    if (!mlEnabled || !faceAlbumEnabled) return null

    const existingClusterTaskId = await this.findPendingFaceClusterTask(
      ownerUserId,
    )
    if (existingClusterTaskId) return existingClusterTaskId

    return await this.addTask(
      {
        type: 'photo-face-cluster',
        ownerUserId,
      },
      {
        priority: 0,
        maxAttempts: 3,
      },
    )
  }

  async findPendingFaceClusterTask(ownerUserId?: number | null) {
    const tasks = await useDB().select().from(tables.pipelineQueue).all()
    const normalizedOwnerUserId = ownerUserId ?? null
    const existing = tasks.find((task) => {
      if (task.payload?.type !== 'photo-face-cluster') return false
      if (!(task.status === 'pending' || task.status === 'in-stages')) {
        return false
      }
      return (task.payload.ownerUserId ?? null) === normalizedOwnerUserId
    })
    return existing?.id ?? null
  }

  async enqueueMachineLearningBackfillTask(ownerUserId?: number | null) {
    const mlEnabled =
      (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
    if (!mlEnabled) return null

    return await this.addTask(
      {
        type: 'photo-ml-backfill',
        ownerUserId,
      },
      {
        priority: 1,
        maxAttempts: 3,
      },
    )
  }

  private async countIndexedFacesForOwner(ownerUserId?: number | null) {
    return await (await getVectorStore()).countFacePayloads({ ownerUserId })
  }

  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns 任务状态信息
   */
  async getTaskStatus(taskId: number) {
    const db = useDB()
    const task = await db
      .select()
      .from(tables.pipelineQueue)
      .where(eq(tables.pipelineQueue.id, taskId))
      .get()
    return task
  }

  /**
   * 获取并锁定下一个待处理任务
   * @returns 下一个待处理任务
   */
  async getNextTask(): Promise<PipelineQueueItem | null> {
    const db = useDB()

    const task = await db.transaction(async (tx) => {
      const highestPriorityPendingTask = await tx
        .select()
        .from(tables.pipelineQueue)
        .where(
          and(
            eq(tables.pipelineQueue.status, 'pending'),
            lte(tables.pipelineQueue.createdAt, new Date()),
          ),
        )
        // 优先处理高优先级和较早创建的任务
        .orderBy(
          desc(tables.pipelineQueue.priority),
          asc(tables.pipelineQueue.createdAt),
        )
        .limit(1)
        .get()

      if (!highestPriorityPendingTask) return null

      const task = highestPriorityPendingTask
      const claimedTask = await tx
        .update(tables.pipelineQueue)
        .set({ status: 'in-stages' })
        .where(
          and(
            eq(tables.pipelineQueue.id, task.id),
            eq(tables.pipelineQueue.status, 'pending'),
            lte(tables.pipelineQueue.createdAt, new Date()),
          ),
        )
        .returning({ id: tables.pipelineQueue.id })
        .get()

      if (!claimedTask) return null

      return { ...task, status: 'in-stages' as const }
    })

    return task
  }

  /**
   * 更新任务阶段
   * @param taskId 任务ID
   * @param stage 新的任务阶段
   */
  async updateTaskStage(
    taskId: number,
    stage: PipelineQueueItem['statusStage'],
  ): Promise<void> {
    const db = useDB()
    await db
      .update(tables.pipelineQueue)
      .set({ statusStage: stage })
      .where(eq(tables.pipelineQueue.id, taskId))
      .run()
  }

  /**
   * 标记任务为已完成
   * @param taskId 任务ID
   */
  async markTaskCompleted(taskId: number): Promise<void> {
    const db = useDB()
    await db
      .update(tables.pipelineQueue)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(tables.pipelineQueue.id, taskId))
      .run()
  }

  /**
   * 标记任务为失败
   * @param taskId 任务ID
   * @param errorMessage 错误信息
   */
  async markTaskFailed(taskId: number, errorMessage?: string): Promise<void> {
    const db = useDB()
    const task = await db
      .select()
      .from(tables.pipelineQueue)
      .where(eq(tables.pipelineQueue.id, taskId))
      .get()

    if (!task) return

    const newAttempts = task.attempts + 1
    const shouldRetry = newAttempts < task.maxAttempts

    // 计算重试延迟（指数退避）
    const retryDelay = shouldRetry
      ? Math.min(1000 * Math.pow(2, newAttempts - 1), 30000)
      : 0

    await db
      .update(tables.pipelineQueue)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        attempts: newAttempts,
        errorMessage: errorMessage || 'Unknown error',
        // 如果重试，设置延迟重试时间
        ...(shouldRetry && retryDelay > 0
          ? {
              createdAt: new Date(Date.now() + retryDelay),
            }
          : {}),
      })
      .where(eq(tables.pipelineQueue.id, taskId))
      .run()

    if (shouldRetry) {
      this.logger.warn(
        `Task ${taskId} failed (attempt ${newAttempts}/${task.maxAttempts}), will retry in ${retryDelay}ms: ${errorMessage}`,
      )
    } else {
      this.logger.error(
        `Task ${taskId} failed permanently after ${newAttempts} attempts: ${errorMessage}`,
      )
    }
  }

  /** 任务处理器 */
  private processors = (() => {
    return {
      photo: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo') {
          throw new Error(
            `Invalid payload type for photo task: ${payload.type}`,
          )
        }
        const { storageKey } = payload
        const storageProvider = getStorageManager().getProvider()
        const photoId = generateSafePhotoId(storageKey)

        try {
          this.logger.info(`Start processing task ${taskId}: ${storageKey}`)

          let storageObject = await storageProvider.getFileMeta(storageKey)
          if (!storageObject) {
            // Fallback: try read the file directly to confirm existence (e.g., local provider)
            const maybeBuffer = await storageProvider.get(storageKey)
            if (maybeBuffer) {
              storageObject = {
                key: storageKey,
                size: maybeBuffer.length,
                lastModified: new Date(),
              }
            }
          }
          if (!storageObject) {
            throw new Error(`Storage object not found`)
          }

          const ownerUserId = Number(payload.ownerUserId)
          if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) {
            throw new Error('Photo task is missing a resolved owner')
          }

          // STEP 1: 预处理 - 转换 HEIC 到 JPEG 并上传
          await this.updateTaskStage(taskId, 'preprocessing')
          this.logger.info(`[${taskId}:in-stage] preprocessing`)
          const imageBuffers = await preprocessImageWithJpegUpload(storageKey, {
            photoId,
            ownerUserId,
          })
          if (!imageBuffers) {
            throw new Error('Preprocessing failed')
          }

          // STEP 2: 元数据处理 - 使用 Sharp 处理图片元数据
          await this.updateTaskStage(taskId, 'metadata')
          this.logger.info(`[${taskId}:in-stage] metadata extraction`)
          const processedData = await processImageMetadataAndSharp(
            imageBuffers.processed,
            storageKey,
          )
          if (!processedData) {
            throw new Error('Metadata processing failed')
          }

          const { imageBuffer, metadata } = processedData

          // STEP 3: 生成多尺寸派生图
          await this.updateTaskStage(taskId, 'variants')
          this.logger.info(`[${taskId}:in-stage] image variants generation`)
          const { imageVariants, thumbnailHash } =
            await generateImageVariantsAndHash({
              buffer: imageBuffer,
              photoId,
              ownerUserId,
              storageProvider,
              logger: this.logger,
            })
          const thumbnailVariant = imageVariants.card || imageVariants.thumb

          // STEP 4: 提取 EXIF 数据
          await this.updateTaskStage(taskId, 'exif')
          this.logger.info(`[${taskId}:in-stage] exif extraction`)
          const exifData = await extractExifData(
            imageBuffer,
            imageBuffers.raw,
            this.logger,
          )
          const systemAutoEraseLocationOnUpload =
            (await settingsManager.get<boolean>(
              'privacy',
              'upload.autoEraseLocation',
            )) ?? false
          const shouldAutoEraseLocationOnUpload =
            typeof payload.eraseLocation === 'boolean'
              ? payload.eraseLocation
              : systemAutoEraseLocationOnUpload
          const normalizedExifData = shouldAutoEraseLocationOnUpload
            ? stripLocationFromExif(exifData)
            : exifData

          // 提取照片基本信息
          const photoInfo = extractPhotoInfo(storageKey, normalizedExifData)

          // STEP 5: 地理位置反向解析
          // 这里逆编码失败不报错，宽容处理
          await this.updateTaskStage(taskId, 'reverse-geocoding')
          this.logger.info(`[${taskId}:in-stage] reverse geocoding`)

          let coordinates = null
          let locationInfo = null
          if (!shouldAutoEraseLocationOnUpload && normalizedExifData) {
            const { latitude, longitude } =
              parseGPSCoordinates(normalizedExifData)
            coordinates = { latitude, longitude }
            if (latitude && longitude) {
              locationInfo = await extractLocationFromGPS(latitude, longitude)
            }
          }

          // STEP 6: Motion Photo (XMP) 支持
          await this.updateTaskStage(taskId, 'motion-photo')
          this.logger.info(`[${taskId}:in-stage] motion photo detection`)
          const motionPhotoInfo = imageBuffers.raw
            ? await processMotionPhotoFromXmp({
                photoId,
                storageKey,
                rawImageBuffer: imageBuffers.raw,
                exifData: normalizedExifData,
                storageProvider,
                logger: this.logger,
              })
            : null

          if (!imageBuffers.raw) {
            this.logger.warn(
              `[${taskId}:in-stage] motion photo detection skipped: missing raw buffer for ${storageKey}`,
            )
          }

          // STEP 7: LivePhoto 视频配对（独立 MOV 文件）
          await this.updateTaskStage(taskId, 'live-photo')
          this.logger.info(`[${taskId}:in-stage] live photo detection`)
          let livePhotoInfo = null
          if (!motionPhotoInfo?.isMotionPhoto) {
            const livePhotoVideo = await findLivePhotoVideoForImage(storageKey)
            if (livePhotoVideo) {
              livePhotoInfo = {
                isLivePhoto: 1,
                livePhotoVideoUrl: storageProvider.getPublicUrl(
                  livePhotoVideo.videoKey,
                ),
                livePhotoVideoKey: livePhotoVideo.videoKey,
              }
              this.logger.info(
                `[${taskId}:in-stage] found LivePhoto video: ${livePhotoVideo.videoKey}`,
              )
            }
          } else {
            livePhotoInfo = {
              isLivePhoto: 1,
              livePhotoVideoUrl: motionPhotoInfo.livePhotoVideoUrl || null,
              livePhotoVideoKey: motionPhotoInfo.livePhotoVideoKey || null,
            }
          }

          const db = useDB()
          const existingPhoto = await db
            .select({ ownerUserId: tables.photos.ownerUserId })
            .from(tables.photos)
            .where(eq(tables.photos.id, photoId))
            .get()

          if (
            existingPhoto?.ownerUserId != null &&
            !isSameUserId(existingPhoto.ownerUserId, ownerUserId)
          ) {
            throw new Error('Photo task owner does not match existing photo')
          }

          if (
            existingPhoto?.ownerUserId == null &&
            !isStorageKeyInUserNamespace(storageKey, ownerUserId)
          ) {
            throw new Error('Photo task owner does not match storage namespace')
          }

          // 构建最终的 Photo 对象
          const result: Photo = {
            id: photoId,
            title: photoInfo.title,
            description: photoInfo.description,
            dateTaken: photoInfo.dateTaken,
            tags: photoInfo.tags,
            width: metadata.width,
            height: metadata.height,
            aspectRatio: metadata.width / metadata.height,
            sourceType: imageBuffers.sourceType,
            storageKey: storageKey,
            displayStorageKey: imageBuffers.displayStorageKey || null,
            displayMimeType: imageBuffers.displayMimeType || null,
            displayFileSize: imageBuffers.displayFileSize || null,
            displayWidth: imageBuffers.displayWidth || null,
            displayHeight: imageBuffers.displayHeight || null,
            thumbnailKey: thumbnailVariant?.key || null,
            fileSize: storageObject.size || null,
            lastModified:
              storageObject.lastModified?.toISOString() ||
              new Date().toISOString(),
            originalUrl: imageBuffers.jpegKey
              ? storageProvider.getPublicUrl(imageBuffers.jpegKey) // 使用 JPEG 版本作为 originalUrl
              : imageBuffers.displayStorageKey
                ? storageProvider.getPublicUrl(imageBuffers.displayStorageKey)
                : storageProvider.getPublicUrl(storageKey),
            thumbnailUrl: thumbnailVariant?.url || null,
            thumbnailHash: thumbnailHash
              ? compressUint8Array(thumbnailHash)
              : null,
            imageVariants,
            exif: normalizedExifData,
            // 地理位置信息
            latitude: coordinates?.latitude || null,
            longitude: coordinates?.longitude || null,
            country: locationInfo?.country || null,
            city: locationInfo?.city || null,
            locationName: locationInfo?.locationName || null,
            // LivePhoto 相关字段
            isLivePhoto:
              motionPhotoInfo?.isMotionPhoto || livePhotoInfo?.isLivePhoto
                ? 1
                : 0,
            livePhotoVideoUrl:
              motionPhotoInfo?.livePhotoVideoUrl ||
              livePhotoInfo?.livePhotoVideoUrl ||
              null,
            livePhotoVideoKey:
              motionPhotoInfo?.livePhotoVideoKey ||
              livePhotoInfo?.livePhotoVideoKey ||
              null,
            ownerUserId,
            visibility: 'private',
          }

          await db
            .insert(tables.photos)
            .values(result)
            .onConflictDoUpdate({
              target: tables.photos.id,
              set: result,
            })
            .run()

          if (imageBuffers.primaryAsset) {
            await db
              .delete(tables.photoAssets)
              .where(
                and(
                  eq(tables.photoAssets.photoId, photoId),
                  eq(tables.photoAssets.kind, 'embedded-preview'),
                ),
              )
              .run()
            await db
              .insert(tables.photoAssets)
              .values(imageBuffers.primaryAsset)
              .run()
          }

          if (shouldAutoEraseLocationOnUpload) {
            try {
              await this.addTask(
                {
                  type: 'photo-erase-location',
                  photoId,
                },
                {
                  priority: 2,
                  maxAttempts: 3,
                },
              )
            } catch (enqueueError) {
              this.logger.warn(
                `[${taskId}:location-erase] failed to enqueue location erase task for ${photoId}`,
                enqueueError,
              )
            }
          }

          try {
            await this.enqueueMachineLearningIndexTask(photoId, ownerUserId)
          } catch (enqueueError) {
            this.logger.warn(
              `[${taskId}:ml-index] failed to enqueue machine learning index task for ${photoId}`,
              enqueueError,
            )
          }

          this.logger.success(`Task ${taskId} processed successfully`)
          return result
        } catch (error) {
          this.logger.error(`Task ${taskId} processing failed`, error)
          throw error
        }
      },
      photoVariants: async (task: PipelineQueueItem) => {
        const db = useDB()
        const { id: taskId, payload } = task
        const storageProvider = getStorageManager().getProvider()

        if (payload.type !== 'photo-variants') {
          throw new Error(
            `Invalid payload type for photo variants task: ${payload.type}`,
          )
        }

        const photo = await db
          .select()
          .from(tables.photos)
          .where(eq(tables.photos.id, payload.photoId))
          .get()

        if (!photo?.storageKey) {
          throw new Error(
            `Photo ${payload.photoId} has no original storage key`,
          )
        }

        const ownerUserId = Number(photo.ownerUserId)
        if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) {
          throw new Error(`Photo ${payload.photoId} is missing an owner`)
        }

        try {
          await this.updateTaskStage(taskId, 'variants')
          this.logger.info(
            `[${taskId}:in-stage] rebuilding image variants for ${payload.photoId}`,
          )

          const variantSourceKey = getPhotoDisplayStorageKey(photo)
          if (!variantSourceKey) {
            throw new Error(
              `Photo ${payload.photoId} has no display source key`,
            )
          }

          const imageBuffers = await preprocessImageWithJpegUpload(
            variantSourceKey,
            {
              photoId: photo.id,
              ownerUserId,
              allowRaw: false,
            },
          )
          if (!imageBuffers) {
            throw new Error('Preprocessing failed')
          }

          const processedData = await processImageMetadataAndSharp(
            imageBuffers.processed,
            photo.storageKey,
          )
          if (!processedData) {
            throw new Error('Metadata processing failed')
          }

          const { imageVariants, thumbnailHash } =
            await generateImageVariantsAndHash({
              buffer: processedData.imageBuffer,
              photoId: photo.id,
              ownerUserId,
              storageProvider,
              logger: this.logger,
            })
          const thumbnailVariant = imageVariants.card || imageVariants.thumb

          await db
            .update(tables.photos)
            .set({
              width: processedData.metadata.width,
              height: processedData.metadata.height,
              aspectRatio:
                processedData.metadata.width / processedData.metadata.height,
              displayWidth: photo.displayStorageKey
                ? processedData.metadata.width
                : photo.displayWidth,
              displayHeight: photo.displayStorageKey
                ? processedData.metadata.height
                : photo.displayHeight,
              thumbnailKey: thumbnailVariant?.key || photo.thumbnailKey,
              thumbnailUrl: thumbnailVariant?.url || photo.thumbnailUrl,
              thumbnailHash: thumbnailHash
                ? compressUint8Array(thumbnailHash)
                : photo.thumbnailHash,
              imageVariants,
            })
            .where(eq(tables.photos.id, photo.id))
            .run()

          if (payload.reindexMlAfterVariants) {
            try {
              await this.enqueueMachineLearningIndexTask(photo.id, ownerUserId)
            } catch (enqueueError) {
              this.logger.warn(
                `[${taskId}:ml-index] failed to enqueue machine learning reindex task for ${photo.id}`,
                enqueueError,
              )
            }
          }

          this.logger.success(
            `Image variants task ${taskId} processed successfully for ${photo.id}`,
          )
        } catch (error) {
          this.logger.error(
            `Image variants task ${taskId} processing failed`,
            error,
          )
          throw error
        }
      },
      reverseGeocoding: async (task: PipelineQueueItem) => {
        const db = useDB()
        const { id: taskId, payload } = task

        if (payload.type !== 'photo-reverse-geocoding') {
          throw new Error(
            `Invalid payload type for reverse geocoding task: ${payload.type}`,
          )
        }

        const { photoId } = payload

        try {
          await this.updateTaskStage(taskId, 'reverse-geocoding')
          this.logger.info(
            `[${taskId}:in-stage] reverse geocoding for photo ${photoId}`,
          )

          const photo = await db
            .select()
            .from(tables.photos)
            .where(eq(tables.photos.id, photoId))
            .get()

          if (!photo) {
            this.logger.warn(
              `[${taskId}:reverse-geocoding] photo ${photoId} not found`,
            )
            throw new Error(`Photo ${photoId} not found`)
          }

          let latitude = payload.latitude ?? photo.latitude ?? undefined
          let longitude = payload.longitude ?? photo.longitude ?? undefined

          if (
            latitude === undefined ||
            latitude === null ||
            longitude === undefined ||
            longitude === null
          ) {
            if (photo.exif) {
              const coords = parseGPSCoordinates(photo.exif)
              if (latitude === undefined || latitude === null) {
                latitude = coords.latitude
              }
              if (longitude === undefined || longitude === null) {
                longitude = coords.longitude
              }
            }
          }

          const hasLatitude = latitude !== undefined && latitude !== null
          const hasLongitude = longitude !== undefined && longitude !== null

          if (!hasLatitude || !hasLongitude) {
            this.logger.warn(
              `[${taskId}:reverse-geocoding] missing coordinates for photo ${photoId}`,
            )
            await db
              .update(tables.photos)
              .set({
                latitude: null,
                longitude: null,
                country: null,
                city: null,
                locationName: null,
              })
              .where(eq(tables.photos.id, photoId))
              .run()
            throw new Error(`Missing coordinates for photo ${photoId}`)
          }

          const locationInfo = await extractLocationFromGPS(
            latitude!,
            longitude!,
          )

          if (!locationInfo) {
            throw new Error(
              `Failed to extract location from GPS coordinates (${latitude}, ${longitude}), maybe network issue?`,
            )
          }

          await db
            .update(tables.photos)
            .set({
              latitude: latitude!,
              longitude: longitude!,
              country: locationInfo.country ?? null,
              city: locationInfo.city ?? null,
              locationName: locationInfo.locationName ?? null,
            })
            .where(eq(tables.photos.id, photoId))
            .run()

          this.logger.success(
            `[${taskId}:reverse-geocoding] updated location for photo ${photoId}`,
          )
        } catch (error) {
          this.logger.error(
            `[${taskId}:reverse-geocoding] failed for photo ${photoId}`,
            error,
          )
          throw error
        }
      },
      machineLearningIndex: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-ml-index') {
          throw new Error(
            `Invalid payload type for ML index task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'ml-index')
        this.logger.info(
          `[${taskId}:in-stage] machine learning fan-out for photo ${payload.photoId}`,
        )

        await this.enqueueMachineLearningSemanticEmbeddingTask(
          payload.photoId,
          payload.ownerUserId,
        )
        await this.enqueuePhotoAiAnalysisTask(
          payload.photoId,
          payload.ownerUserId,
        )
        await this.enqueueFaceDetectTask(payload.photoId, payload.ownerUserId)
        this.logger.success(
          `[${taskId}:ml-index] queued independent ML tasks for photo ${payload.photoId}`,
        )
      },
      machineLearningAutoTags: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-ml-auto-tags') {
          throw new Error(
            `Invalid payload type for ML auto tag task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'ml-auto-tags')
        const result = await indexPhotoAutoTags(payload.photoId)
        this.logger.success(
          `[${taskId}:ml-auto-tags] indexed ${result.tags ?? 0} tags for photo ${payload.photoId}`,
        )
      },
      machineLearningSemanticEmbedding: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-ml-semantic-embedding') {
          throw new Error(
            `Invalid payload type for ML semantic embedding task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'ml-semantic-embedding')
        const result = await indexPhotoSemanticEmbedding(payload.photoId)
        if (result.skipped) {
          this.logger.info(
            `[${taskId}:ml-semantic-embedding] skipped photo ${payload.photoId}: ${result.reason}`,
          )
        } else {
          this.logger.success(
            `[${taskId}:ml-semantic-embedding] indexed ${result.embeddingDim} dimensions for photo ${payload.photoId}`,
          )
        }
      },
      photoAiAnalysis: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-ai-analysis') {
          throw new Error(
            `Invalid payload type for AI analysis task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'ml-ai-analysis')
        const result = await indexPhotoAiAnalysis(
          payload.photoId,
          payload.stages,
          async (stage) => {
            await this.updateTaskStage(taskId, `ml-ai-analysis-${stage}` as any)
          },
        )
        if (result.skipped) {
          this.logger.info(
            `[${taskId}:ml-ai-analysis] skipped photo ${payload.photoId}: ${result.reason}`,
          )
        } else {
          this.logger.success(
            `[${taskId}:ml-ai-analysis] analyzed photo ${payload.photoId}`,
          )
        }
      },
      faceDetect: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-face-detect') {
          throw new Error(
            `Invalid payload type for face detect task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'face-detection')
        const result = await indexPhotoFaces(payload.photoId)
        if (result.skipped) {
          this.logger.info(
            `[${taskId}:face-detection] skipped photo ${payload.photoId}: ${result.reason}`,
          )
        } else {
          this.logger.success(
            `[${taskId}:face-detection] indexed ${result.faces} faces for photo ${payload.photoId}`,
          )
          await this.enqueueFaceClusterTask(payload.ownerUserId)
        }
      },
      machineLearningBackfill: async (task: PipelineQueueItem) => {
        const db = useDB()
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-ml-backfill') {
          throw new Error(
            `Invalid payload type for ML backfill task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'ml-backfill')
        this.logger.info(`[${taskId}:in-stage] machine learning backfill`)

        const ownerUserId = Number(payload.ownerUserId)
        const photosQuery = db
          .select({
            id: tables.photos.id,
            ownerUserId: tables.photos.ownerUserId,
          })
          .from(tables.photos)

        const photos =
          Number.isSafeInteger(ownerUserId) && ownerUserId > 0
            ? await photosQuery
                .where(eq(tables.photos.ownerUserId, ownerUserId))
                .all()
            : await photosQuery.all()

        for (const photo of photos) {
          await this.enqueueMachineLearningSemanticEmbeddingTask(
            photo.id,
            photo.ownerUserId,
          )
          await this.enqueuePhotoAiAnalysisTask(photo.id, photo.ownerUserId)
          await this.enqueueFaceDetectTask(photo.id, photo.ownerUserId)
        }
      },
      faceCluster: async (task: PipelineQueueItem) => {
        const { id: taskId, payload } = task
        if (payload.type !== 'photo-face-cluster') {
          throw new Error(
            `Invalid payload type for face cluster task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'face-cluster')
        const mlEnabled =
          (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
        if (!mlEnabled) {
          this.logger.info(
            `[${taskId}:face-cluster] skipped: Machine learning is disabled`,
          )
          return
        }

        const faceAlbumEnabled =
          (await settingsManager.get<boolean>(
            'system',
            'ml.faceAlbum.enabled',
          )) ?? false
        if (!faceAlbumEnabled) {
          this.logger.info(`[${taskId}:face-cluster] skipped: disabled`)
          return
        }

        this.logger.info(
          `[${taskId}:face-cluster] face clustering requested for owner ${payload.ownerUserId ?? 'all'}`,
        )

        const indexedFaceCount = await this.countIndexedFacesForOwner(
          payload.ownerUserId,
        )
        if (indexedFaceCount === 0) {
          const backfillTaskId = await this.enqueueMachineLearningBackfillTask(
            payload.ownerUserId,
          )
          this.logger.warn(
            `[${taskId}:face-cluster] no-indexed-faces: 0 indexed faces available for clustering; queued photo-face-detect backfill via photo-ml-backfill task ${backfillTaskId ?? 'none'}`,
          )
          return
        }

        const result = await clusterFacesForOwner(payload.ownerUserId)
        if (result.skipped) {
          this.logger.info(
            `[${taskId}:face-cluster] skipped: ${result.reason}`,
          )
        } else {
          const faceSummary =
            result.faces === 0
              ? '0 indexed faces available for clustering'
              : `clustered ${result.faces} faces into ${result.people} people`
          this.logger.success(
            `[${taskId}:face-cluster] ${faceSummary}`,
          )
        }
      },
      eraseLocation: async (task: PipelineQueueItem) => {
        const db = useDB()
        const storageProvider = getStorageManager().getProvider()
        const { id: taskId, payload } = task

        if (payload.type !== 'photo-erase-location') {
          throw new Error(
            `Invalid payload type for erase location task: ${payload.type}`,
          )
        }

        await this.updateTaskStage(taskId, 'location-erase')
        this.logger.info(
          `[${taskId}:in-stage] erase location info for photo ${payload.photoId}`,
        )

        const photo = await db
          .select()
          .from(tables.photos)
          .where(eq(tables.photos.id, payload.photoId))
          .get()

        if (!photo) {
          throw new Error(`Photo ${payload.photoId} not found`)
        }

        if (!photo.storageKey) {
          throw new Error(`Photo ${payload.photoId} has no storage key`)
        }

        const originalBuffer = await storageProvider.get(photo.storageKey)
        if (!originalBuffer) {
          throw new Error(`Photo file ${photo.storageKey} not found in storage`)
        }

        const tempRoot = tmpdir()
        await mkdir(tempRoot, { recursive: true })
        const tempDir = await mkdtemp(path.join(tempRoot, 'cframe-location-'))
        const ext = path.extname(photo.storageKey) || '.jpg'
        const tempFile = path.join(tempDir, `erase-location${ext}`)

        try {
          await writeFile(tempFile, originalBuffer)

          const exifLocationNullMap = EXIF_LOCATION_KEYS.reduce(
            (acc, key) => {
              acc[key] = null
              return acc
            },
            {} as Record<string, null>,
          )

          await exiftool.write(tempFile, exifLocationNullMap, [
            '-overwrite_original',
          ])

          const updatedBuffer = await readFile(tempFile)

          const prefix =
            storageProvider.config && 'prefix' in storageProvider.config
              ? storageProvider.config.prefix
              : ''

          await storageProvider.create(
            photo.storageKey.replace(prefix || '', ''),
            updatedBuffer,
          )

          const exifData = stripLocationFromExif(
            await extractExifData(updatedBuffer),
          )

          await db
            .update(tables.photos)
            .set({
              exif: exifData,
              fileSize: updatedBuffer.length,
              lastModified: new Date().toISOString(),
              latitude: null,
              longitude: null,
              country: null,
              city: null,
              locationName: null,
            })
            .where(eq(tables.photos.id, payload.photoId))
            .run()

          this.logger.success(
            `[${taskId}:location-erase] erased location info for photo ${payload.photoId}`,
          )
        } finally {
          await rm(tempDir, { recursive: true, force: true })
        }
      },
      livePhotoDetect: async (task: PipelineQueueItem) => {
        const db = useDB()
        const storageProvider = getStorageManager().getProvider()

        const { id: taskId, payload } = task
        if (payload.type !== 'live-photo-video') {
          throw new Error(
            `Invalid payload type for live-photo task: ${payload.type}`,
          )
        }
        const { storageKey: videoKey } = payload

        try {
          this.logger.info(
            `Start processing LivePhoto detection task ${taskId}: ${videoKey}`,
          )

          let storageObject = await storageProvider.getFileMeta(videoKey)
          if (!storageObject) {
            const maybeBuffer = await storageProvider.get(videoKey)
            if (maybeBuffer) {
              storageObject = {
                key: videoKey,
                size: maybeBuffer.length,
                lastModified: new Date(),
              }
            }
          }
          if (!storageObject) {
            throw new Error(`Storage object not found`)
          }

          // 寻找是否有同名的照片文件
          const videoDir = path.dirname(videoKey)
          const videoBaseName = path.basename(videoKey, path.extname(videoKey))

          const possiblePhotoKeys = [
            path.join(videoDir, `${videoBaseName}.HEIC`).replace(/\\/g, '/'),
            path.join(videoDir, `${videoBaseName}.heic`).replace(/\\/g, '/'),
            path.join(videoDir, `${videoBaseName}.JPG`).replace(/\\/g, '/'),
            path.join(videoDir, `${videoBaseName}.jpg`).replace(/\\/g, '/'),
            path.join(videoDir, `${videoBaseName}.JPEG`).replace(/\\/g, '/'),
            path.join(videoDir, `${videoBaseName}.jpeg`).replace(/\\/g, '/'),
          ]

          let matchedPhoto: Photo | null = null
          for (const photoKey of possiblePhotoKeys) {
            const photos = await db
              .select()
              .from(tables.photos)
              .where(eq(tables.photos.storageKey, photoKey))
              .limit(1)
              .all()

            const matched = photos[0]
            if (matched) {
              matchedPhoto = matched
              this.logger.info(
                `Found matching photo for LivePhoto video: ${photoKey}`,
              )
              break
            }
          }

          if (!matchedPhoto) {
            this.logger.warn(
              `No matching photo found for LivePhoto video: ${videoKey}`,
            )
            throw new Error(
              `No matching photo found for LivePhoto video: ${videoKey}`,
            )
          }

          const livePhotoVideoUrl = storageProvider.getPublicUrl(videoKey)
          await db
            .update(tables.photos)
            .set({
              isLivePhoto: 1,
              livePhotoVideoUrl,
              livePhotoVideoKey: videoKey,
            })
            .where(eq(tables.photos.id, matchedPhoto.id))
            .run()

          this.logger.success(
            `LivePhoto detection task ${taskId} processed successfully, updated photo ${matchedPhoto.id}`,
          )
        } catch (error) {
          this.logger.error(
            `LivePhoto detection task ${taskId} processing failed`,
            error,
          )
          throw error
        }
      },
    }
  })()

  /**
   * 处理下一个待处理任务
   */
  private async processNextTask(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Task is already processing, skipping this poll')
      return
    }

    this.isProcessing = true

    try {
      const task = await this.getNextTask()
      if (!task) {
        this.logger.debug('No tasks to process at the moment')
        return
      }

      try {
        const { type } = task.payload

        switch (type) {
          case 'live-photo-video':
            await this.processors.livePhotoDetect(task)
            break
          case 'photo':
            await this.processors.photo(task)
            break
          case 'photo-variants':
            await this.processors.photoVariants(task)
            break
          case 'photo-reverse-geocoding':
            await this.processors.reverseGeocoding(task)
            break
          case 'photo-ml-index':
            await this.processors.machineLearningIndex(task)
            break
          case 'photo-ml-auto-tags':
            await this.processors.machineLearningAutoTags(task)
            break
          case 'photo-ml-semantic-embedding':
            await this.processors.machineLearningSemanticEmbedding(task)
            break
          case 'photo-ai-analysis':
            await this.processors.photoAiAnalysis(task)
            break
          case 'photo-face-detect':
            await this.processors.faceDetect(task)
            break
          case 'photo-ml-backfill':
            await this.processors.machineLearningBackfill(task)
            break
          case 'photo-face-cluster':
            await this.processors.faceCluster(task)
            break
          case 'photo-erase-location':
            await this.processors.eraseLocation(task)
            break
          default:
            throw new Error(`Unknown task type: ${type}`)
        }

        await this.markTaskCompleted(task.id)
        this.processedCount++
        this.logger.success(
          `[${this.workerId}] Task ${task.id} processed successfully (Total: ${this.processedCount})`,
        )

        // const result = await this.processTask(task)
        // if (result) {
        //   await this.markTaskCompleted(task.id)
        //   this.processedCount++
        //   this.logger.success(
        //     `[${this.workerId}] Task ${task.id} processed successfully (Total: ${this.processedCount})`,
        //   )
        // } else {
        //   await this.markTaskFailed(task.id, 'Processing result is empty')
        //   this.errorCount++
        // }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        await this.markTaskFailed(task.id, errorMessage)
        this.errorCount++
        this.logger.error(
          `[${this.workerId}] Task ${task.id} processing failed (Error: ${this.errorCount}):`,
          errorMessage,
        )
      }
    } catch (error) {
      this.logger.error('Error occurred while fetching the next task:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 开始处理队列
   * @param intervalMs 轮询间隔
   */
  startProcessing(intervalMs: number = 3000): void {
    if (this.processingInterval) return

    this.processingInterval = setInterval(() => {
      this.processNextTask().catch((error) => {
        this.logger.error('Error occurred while processing the queue:', error)
      })
    }, intervalMs)

    this.logger.success(
      `Queue processing started with interval: ${intervalMs}ms`,
    )

    this.processNextTask().catch((error) => {
      this.logger.error('Error occurred while processing the queue:', error)
    })
  }

  /**
   * 停止处理队列
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      this.logger.warn('Queue processing stopped')
    }
  }

  /**
   * 获取队列统计信息
   * @returns 队列统计信息
   */
  async getQueueStats() {
    const db = useDB()
    const stats = await db
      .select({
        status: tables.pipelineQueue.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(tables.pipelineQueue)
      .groupBy(tables.pipelineQueue.status)
      .all()

    return stats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat.count
        return acc
      },
      {} as Record<string, number>,
    )
  }
}
