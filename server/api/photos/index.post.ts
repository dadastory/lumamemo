import path from 'path'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'
import { and, eq } from 'drizzle-orm'
import { generateSafePhotoId } from '~~/server/utils/file-utils'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import {
  buildInternalUploadTarget,
  shouldUseBrowserDirectUpload,
} from '~~/server/utils/upload-target'
import {
  RAW_PHOTO_EXTENSIONS,
  getUploadContentType,
  isRawFileName,
} from '~~/shared/utils/raw-photo'

const VIDEO_EXTENSIONS = new Set(['.mov', '.mp4'])

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
  ...RAW_PHOTO_EXTENSIONS,
])

const isVideoFile = (
  fileName: string,
  contentType?: string | null,
): boolean => {
  if (contentType?.toLowerCase().startsWith('video/')) {
    return true
  }

  const ext = path.extname(fileName).toLowerCase()
  return ext !== '' && VIDEO_EXTENSIONS.has(ext)
}

const isLikelyImageKey = (storageKey?: string | null): boolean => {
  if (!storageKey) {
    return false
  }

  const ext = path.extname(storageKey).toLowerCase()
  return ext !== '' && IMAGE_EXTENSIONS.has(ext)
}

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const { storageProvider } = useStorageProvider(event)
  const t = await useTranslation(event)

  const body = await readBody(event)
  const { fileName, contentType, skipDuplicateCheck } = body
  const uploadContentType =
    fileName && isRawFileName(fileName)
      ? getUploadContentType({ name: fileName, type: contentType })
      : contentType || 'application/octet-stream'
  const isVideoUpload = fileName ? isVideoFile(fileName, contentType) : false

  if (!fileName) {
    throw createError({
      statusCode: 400,
      statusMessage: t('upload.error.required.title'),
    })
  }

  try {
    const prefix = (storageProvider.config?.prefix || '').replace(
      /^\/+|\/+$/g,
      '',
    )
    const userPrefix = `users/${session.user.id}`
    const objectKey = [prefix, userPrefix, fileName].filter(Boolean).join('/')

    // 重复文件检测
    const duplicateCheckEnabled =
      ((await settingsManager.get<boolean>(
        'system',
        'upload.duplicateCheck.enabled',
      )) ??
        true) &&
      !skipDuplicateCheck
    let existingPhoto = null

    if (duplicateCheckEnabled) {
      const photoId = generateSafePhotoId(objectKey)
      const db = useDB()

      existingPhoto = await db
        .select({
          id: tables.photos.id,
          title: tables.photos.title,
          storageKey: tables.photos.storageKey,
          originalUrl: tables.photos.originalUrl,
          thumbnailUrl: tables.photos.thumbnailUrl,
          dateTaken: tables.photos.dateTaken,
        })
        .from(tables.photos)
        .where(
          and(
            eq(tables.photos.id, photoId),
            eq(tables.photos.ownerUserId, session.user.id),
          ),
        )
        .get()

      if (
        existingPhoto &&
        isVideoUpload &&
        isLikelyImageKey(existingPhoto.storageKey)
      ) {
        existingPhoto = null
      }

      if (existingPhoto) {
        const checkMode =
          (await settingsManager.get<'warn' | 'block' | 'skip'>(
            'system',
            'upload.duplicateCheck.mode',
          )) ?? 'skip'

        if (checkMode === 'block') {
          // 阻止模式：直接拒绝上传
          throw createError({
            statusCode: 409,
            statusMessage: t('upload.duplicate.block.title'),
            data: {
              duplicate: true,
              existingPhoto,
              title: t('upload.duplicate.block.title'),
              message: t('upload.duplicate.block.message', { fileName }),
            },
          })
        } else if (checkMode === 'skip') {
          // 跳过模式：返回现有照片信息，不上传
          return {
            skipped: true,
            duplicate: true,
            existingPhoto,
            fileKey: objectKey,
            title: t('upload.duplicate.skip.title'),
            message: t('upload.duplicate.skip.message', { fileName }),
            info: t('upload.duplicate.skip.info', {
              dateTaken:
                existingPhoto.dateTaken || t('common.unknown', 'unknown date'),
            }),
          }
        }
        // 'warn' 模式：继续上传但返回警告信息
      }
    }

    if (shouldUseBrowserDirectUpload(storageProvider)) {
      const signedUrl = await storageProvider.getSignedUrl(objectKey, 3600, {
        contentType: uploadContentType,
      })

      const response: any = {
        signedUrl,
        fileKey: objectKey,
        expiresIn: 3600,
      }

      if (existingPhoto) {
        response.duplicate = true
        response.existingPhoto = existingPhoto
        response.warningInfo = {
          title: t('upload.duplicate.warn.title'),
          message: t('upload.duplicate.warn.message', { fileName }),
          warning: t('upload.duplicate.warn.warning'),
          info: t('upload.duplicate.warn.info', {
            title: existingPhoto.title || fileName,
            dateTaken:
              existingPhoto.dateTaken || t('common.unknown', 'unknown date'),
          }),
        }
      }

      return response
    }

    const response: any = buildInternalUploadTarget(objectKey, 3600)

    if (existingPhoto) {
      response.duplicate = true
      response.existingPhoto = existingPhoto
      response.warningInfo = {
        title: t('upload.duplicate.warn.title'),
        message: t('upload.duplicate.warn.message', { fileName }),
        warning: t('upload.duplicate.warn.warning'),
        info: t('upload.duplicate.warn.info', {
          title: existingPhoto.title || fileName,
          dateTaken:
            existingPhoto.dateTaken || t('common.unknown', 'unknown date'),
        }),
      }
    }

    return response
  } catch (error) {
    if ((error as any).statusCode) {
      throw error
    }
    logger.chrono.error('Failed to prepare upload:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to prepare upload',
    })
  }
})
