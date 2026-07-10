import { sql } from 'drizzle-orm'
import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { getStorageManager } from '~~/server/plugins/3.storage'
import { getPhotoDisplayStorageKey } from '~~/server/utils/raw-photo'
import { eq, getDatabaseProvider, tables, useDB } from '~~/server/utils/db'
import { logger } from '~~/server/utils/logger'
import type {
  PhotoAiAnalysis,
  PhotoAiAnalysisStage,
  PhotoAiStageStatus,
} from '~~/shared/types/photo'
import { settingsManager } from '../settings/settingsManager'
import {
  createMachineLearningClient,
  formatMachineLearningError,
  getMachineLearningSettings,
  parseEmbeddingString,
  resolveMachineLearningLanguage,
  type MachineLearningFace,
  type MachineLearningTag,
} from './client'
import { createVectorStore } from './vector-store'

const mlIndexLogger = logger.dynamic('ml-index')

type MachineLearningStageStatus = 'success' | 'skipped' | 'failed'

type MachineLearningStageResult = {
  status: MachineLearningStageStatus
  reason?: string
  error?: string
  tags?: number
  embeddingDim?: number
  faces?: number
  description?: boolean
}

const PHOTO_AI_ANALYSIS_STAGES = [
  'tags',
  'description',
  'score',
  'critique',
  'suggestions',
] as const satisfies PhotoAiAnalysisStage[]

const getErrorMessage = (error: unknown) => formatMachineLearningError(error)

const nowIso = () => new Date().toISOString()

const normalizeTagText = (tag: string) => tag.trim()

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const rawTag of tags) {
    const tag = normalizeTagText(rawTag)
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    normalized.push(tag)
  }
  return normalized
}

export const mergeUserAndAiTags = (
  userTags: string[] | null | undefined,
  aiTags: string[] | null | undefined,
) => uniqueTags([...(userTags || []), ...(aiTags || [])])

const normalizeAiAnalysis = (
  analysis: PhotoAiAnalysis | null | undefined,
): PhotoAiAnalysis => {
  const normalized: PhotoAiAnalysis = analysis ? { ...analysis } : {}
  normalized.stages = analysis?.stages ? { ...analysis.stages } : {}
  return normalized
}

const markAiAnalysisStage = (
  analysis: PhotoAiAnalysis,
  stage: PhotoAiAnalysisStage,
  status: PhotoAiStageStatus,
  error?: string | null,
) => {
  const stages = analysis.stages ? { ...analysis.stages } : {}
  stages[stage] = {
    status,
    error: error || null,
    updatedAt: nowIso(),
  }
  analysis.stages = stages
}

const clampScore = (score: unknown) => {
  const value = Number(score)
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

const stableFaceId = (photoId: string, index: number) => {
  const hex = createHash('sha1')
    .update(`${photoId}:${index}`)
    .digest('hex')
    .slice(0, 12)
  return (Number.parseInt(hex, 16) % 2147483647) + 1
}

const cosineSimilarity = (left: number[], right: number[]) => {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < length; index++) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] * left[index]
    rightMagnitude += right[index] * right[index]
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

const normalizeRows = (result: any): any[] => {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.rows)) return result.rows
  if (Array.isArray(result?.[0])) return result[0]
  return []
}

const coerceFaceEmbedding = (embedding: MachineLearningFace['embedding']) => {
  if (Array.isArray(embedding)) return embedding.map(Number)
  if (typeof embedding === 'string') return parseEmbeddingString(embedding)
  return []
}

const toBoundingBox = (face: MachineLearningFace) => {
  const box = face.boundingBox
  if (!box) return null

  const x = Number(box.x1)
  const y = Number(box.y1)
  const width = Number(box.x2) - x
  const height = Number(box.y2) - y
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null

  return { x, y, width, height }
}

export const getFaceCropStorageKey = (
  photo: typeof tables.photos.$inferSelect,
  faceId: number,
) =>
  `photos/users/${photo.ownerUserId || 'unknown'}/faces/${photo.id}/${faceId}-${randomUUID()}.webp`

export const generateFaceCrop = async (
  photo: typeof tables.photos.$inferSelect,
  faceId: number,
  image: Uint8Array | Buffer,
  boundingBox: { x: number; y: number; width: number; height: number },
) => {
  const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image)
  const metadata = await sharp(buffer, { limitInputPixels: false }).metadata()
  const imageWidth = metadata.width || 0
  const imageHeight = metadata.height || 0
  if (!imageWidth || !imageHeight) return null

  const padding = Math.max(boundingBox.width, boundingBox.height) * 0.2
  const left = Math.max(0, Math.floor(boundingBox.x - padding))
  const top = Math.max(0, Math.floor(boundingBox.y - padding))
  const right = Math.min(
    imageWidth,
    Math.ceil(boundingBox.x + boundingBox.width + padding),
  )
  const bottom = Math.min(
    imageHeight,
    Math.ceil(boundingBox.y + boundingBox.height + padding),
  )
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) return null

  const { data, info } = await sharp(buffer, { limitInputPixels: false })
    .extract({ left, top, width, height })
    .resize({
      width: 320,
      height: 320,
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: true,
    })
    .webp({ quality: 86 })
    .toBuffer({ resolveWithObject: true })

  const storageProvider = getStorageManager().getProvider()
  const cropStorageKey = getFaceCropStorageKey(photo, faceId)
  const object = await storageProvider.create(cropStorageKey, data, 'image/webp')

  return {
    cropStorageKey: object.key,
    cropWidth: info.width,
    cropHeight: info.height,
    cropSize: object.size ?? data.length,
  }
}

const assertEmbedding = (embedding: number[]) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Empty embedding returned from machine learning service')
  }

  if (!embedding.every((value) => Number.isFinite(value))) {
    throw new Error('Machine learning service returned an invalid embedding')
  }
}

type GeneratedFaceData = {
  faceId: number
  boundingBox: { x: number; y: number; width: number; height: number }
  score?: number | null
  embedding: number[]
  cropStorageKey: string
  cropWidth: number
  cropHeight: number
  cropSize: number
}

export const cleanupGeneratedFaceCrops = async (
  faces: Array<Pick<GeneratedFaceData, 'cropStorageKey'>>,
) => {
  const storageProvider = getStorageManager().getProvider()
  for (const face of faces) {
    try {
      await storageProvider.delete(face.cropStorageKey)
    } catch (error) {
      mlIndexLogger.warn(
        `Failed to delete generated face crop ${face.cropStorageKey}: ${getErrorMessage(error)}`,
      )
    }
  }
}

export const deleteExistingFaceDataForPhoto = async (
  photoId: string,
  existingFaces: Array<{ cropStorageKey?: string | null }>,
  vectorStore: ReturnType<typeof createVectorStore>,
) => {
  const storageProvider = getStorageManager().getProvider()
  for (const face of existingFaces) {
    if (!face.cropStorageKey) continue
    try {
      await storageProvider.delete(face.cropStorageKey)
    } catch (error) {
      mlIndexLogger.warn(
        `Failed to delete existing face crop ${face.cropStorageKey}: ${getErrorMessage(error)}`,
      )
    }
  }

  await vectorStore.deleteFaceEmbeddingsForPhoto(photoId)
}

export const upsertPhotoEmbedding = async (
  photo: typeof tables.photos.$inferSelect,
  modelName: string,
  embedding: number[],
) => {
  assertEmbedding(embedding)
  const settings = await getMachineLearningSettings()
  await createVectorStore(settings).upsertPhotoEmbedding({
    photoId: photo.id,
    ownerUserId: photo.ownerUserId,
    visibility: photo.visibility,
    modelName,
    embedding,
  })
}

export const buildEmbeddingInput = (
  photo: typeof tables.photos.$inferSelect,
  analysis: { caption?: string; tags?: MachineLearningTag[] },
) => {
  const exif = (photo.exif || {}) as Record<string, unknown>
  const tags = [
    ...(photo.tags || []),
    ...(photo.aiTags || []),
    ...(analysis.tags || []).map((item) => item.tag),
  ]
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)

  const parts = [
    photo.title ? `Title: ${photo.title}` : '',
    photo.description ? `Description: ${photo.description}` : '',
    analysis.caption ? `Visual caption: ${analysis.caption}` : '',
    tags.length > 0 ? `Tags: ${Array.from(new Set(tags)).join(', ')}` : '',
    photo.locationName ? `Location: ${photo.locationName}` : '',
    photo.city ? `City: ${photo.city}` : '',
    photo.country ? `Country: ${photo.country}` : '',
    exif.Make ? `Camera make: ${String(exif.Make)}` : '',
    exif.Model ? `Camera model: ${String(exif.Model)}` : '',
    exif.LensModel ? `Lens: ${String(exif.LensModel)}` : '',
  ].filter(Boolean)

  return parts.join('\n').slice(0, 4000)
}

const getPhotoForMachineLearning = async (photoId: string) => {
  const db = useDB()
  const photo = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) {
    throw new Error(`Photo ${photoId} not found`)
  }

  return photo
}

const getPhotoAndImageForMachineLearning = async (photoId: string) => {
  const photo = await getPhotoForMachineLearning(photoId)
  const storageKey = getPhotoDisplayStorageKey(photo)
  if (!storageKey) {
    throw new Error(`Photo ${photoId} has no display image for ML indexing`)
  }

  const image = await getStorageManager().getProvider().get(storageKey)
  if (!image) {
    throw new Error(`Display image ${storageKey} not found in storage`)
  }

  return { photo, image }
}

export const indexPhotoAutoTags = async (photoId: string) => {
  const mlEnabled =
    (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
  if (!mlEnabled) return { skipped: true, reason: 'disabled', tags: 0 }

  const autoTagEnabled =
    (await settingsManager.get<boolean>('system', 'ml.autoTag.enabled')) ??
    true
  if (!autoTagEnabled) return { skipped: true, reason: 'disabled', tags: 0 }

  const { photo, image } = await getPhotoAndImageForMachineLearning(photoId)
  const settings = await getMachineLearningSettings()
  const client = createMachineLearningClient(settings)
  const vlmModel = settings.vlmModel
  const { languageName } = await resolveMachineLearningLanguage()
  const analysis = await client.tagPhotoForAiAnalysis(image, vlmModel, languageName)

  const minScore =
    (await settingsManager.get<number>('system', 'ml.autoTag.minScore')) ??
    0.35
  const scoredTags = (analysis.tags || [])
    .map((item) => ({
      tag: String(item.tag || '').trim(),
      score: Number(item.score || 0),
    }))
    .filter((item) => item.tag && Number.isFinite(item.score) && item.score >= minScore)

  if (scoredTags.length === 0) {
    return { skipped: false, photoId, tags: 0 }
  }

  const aiTags = uniqueTags(scoredTags.map((item) => item.tag))
  await useDB()
    .update(tables.photos)
    .set({ aiTags })
    .where(eq(tables.photos.id, photo.id))
    .run()

  return { skipped: false, photoId, tags: scoredTags.length }
}

export const indexPhotoSemanticEmbedding = async (photoId: string) => {
  const mlEnabled =
    (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
  if (!mlEnabled) return { skipped: true, reason: 'disabled' }

  if (getDatabaseProvider() !== 'postgres') {
    return { skipped: true, reason: 'postgres-required' }
  }

  const semanticSearchEnabled =
    (await settingsManager.get<boolean>('system', 'ml.semanticSearch.enabled')) ??
    true
  if (!semanticSearchEnabled) return { skipped: true, reason: 'disabled' }

  const { photo, image } = await getPhotoAndImageForMachineLearning(photoId)
  const settings = await getMachineLearningSettings()
  if (!settings.embeddingModel) return { skipped: true, reason: 'model-empty' }
  const client = createMachineLearningClient(settings)
  const embeddingModel = settings.embeddingModel
  const embedding = await client.embedImage(image, embeddingModel)
  await createVectorStore(settings).deletePhotoEmbeddings(photo.id)
  await upsertPhotoEmbedding(photo, embeddingModel, embedding)

  return {
    skipped: false,
    photoId,
    embeddingDim: embedding.length,
  }
}

export const indexPhotoAiDescription = async (photoId: string) => {
  const result = await indexPhotoAiAnalysis(photoId, ['description'])
  return {
    skipped: result.skipped,
    reason: result.reason,
    description: !result.skipped,
  }
}

export const indexPhotoAiAnalysis = async (
  photoId: string,
  stages?: PhotoAiAnalysisStage[],
  onStageStart?: (stage: PhotoAiAnalysisStage) => Promise<void>,
) => {
  const mlEnabled =
    (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
  if (!mlEnabled) return { skipped: true, reason: 'disabled', photoId }

  const enabled =
    (await settingsManager.get<boolean>('system', 'ml.aiDescription.enabled')) ??
    false
  if (!enabled) return { skipped: true, reason: 'disabled', photoId }

  const selectedStages =
    stages && stages.length > 0
      ? PHOTO_AI_ANALYSIS_STAGES.filter((stage) => stages.includes(stage))
      : [...PHOTO_AI_ANALYSIS_STAGES]
  if (selectedStages.length === 0) {
    return { skipped: true, reason: 'no-stages', photoId }
  }

  const { photo, image } = await getPhotoAndImageForMachineLearning(photoId)
  const settings = await getMachineLearningSettings()
  if (!settings.vlmModel) return { skipped: true, reason: 'model-empty', photoId }

  const client = createMachineLearningClient(settings)
  const vlmModel = settings.vlmModel
  const { code, languageName } = await resolveMachineLearningLanguage()
  const analysis = normalizeAiAnalysis(photo.aiAnalysis)
  analysis.language = code || languageName
  analysis.model = vlmModel

  const updateAnalysis = async (nextAiTags?: string[]) => {
    analysis.generatedAt = nowIso()
    await useDB()
      .update(tables.photos)
      .set({
        aiAnalysis: analysis,
        ...(nextAiTags
          ? {
              aiTags: nextAiTags,
            }
          : {}),
      })
      .where(eq(tables.photos.id, photo.id))
      .run()
  }

  const result = {
    skipped: false,
    photoId,
    stages: {} as Record<PhotoAiAnalysisStage, MachineLearningStageResult>,
  }

  for (const stage of selectedStages) {
    await onStageStart?.(stage)
    markAiAnalysisStage(analysis, stage, 'processing')
    await updateAnalysis()

    try {
      if (stage === 'tags') {
        const autoTagEnabled =
          (await settingsManager.get<boolean>('system', 'ml.autoTag.enabled')) ??
          true
        if (!autoTagEnabled) {
          markAiAnalysisStage(analysis, stage, 'missing')
          result.stages[stage] = { status: 'skipped', reason: 'disabled', tags: 0 }
          await updateAnalysis()
          continue
        }

        const tagResult = await client.tagPhotoForAiAnalysis(
          image,
          vlmModel,
          languageName,
        )
        const minScore =
          (await settingsManager.get<number>('system', 'ml.autoTag.minScore')) ??
          0.35
        const aiTags = uniqueTags(
          (tagResult.tags || [])
            .map((item) => ({
              tag: normalizeTagText(item.tag || ''),
              score: Number(item.score || 0),
            }))
            .filter(
              (item) =>
                item.tag && Number.isFinite(item.score) && item.score >= minScore,
            )
            .map((item) => item.tag),
        )
        markAiAnalysisStage(analysis, stage, 'ready')
        result.stages[stage] = {
          status: 'success',
          tags: aiTags.length,
        }
        await updateAnalysis(aiTags)
        continue
      }

      if (stage === 'description') {
        const description = await client.describePhotoForAiAnalysis(
          image,
          vlmModel,
          languageName,
        )
        analysis.description = description.description || null
      } else if (stage === 'score') {
        const score = await client.scorePhotoForAiAnalysis(
          image,
          vlmModel,
          languageName,
        )
        analysis.score = clampScore(score.score ?? score.scoreBreakdown?.overall)
        analysis.scoreBreakdown = {
          composition: clampScore(score.scoreBreakdown?.composition),
          lighting: clampScore(score.scoreBreakdown?.lighting),
          color: clampScore(score.scoreBreakdown?.color),
          sharpness: clampScore(score.scoreBreakdown?.sharpness),
          overall: clampScore(score.scoreBreakdown?.overall ?? score.score),
        }
      } else if (stage === 'critique') {
        const critique = await client.critiquePhotoForAiAnalysis(
          image,
          vlmModel,
          languageName,
        )
        analysis.evaluation = critique.evaluation || null
        analysis.strengths = critique.strengths || []
      } else if (stage === 'suggestions') {
        const suggestions = await client.suggestPhotoImprovements(
          image,
          vlmModel,
          languageName,
        )
        analysis.suggestions = suggestions.suggestions || []
      }

      markAiAnalysisStage(analysis, stage, 'ready')
      result.stages[stage] = { status: 'success' }
      await updateAnalysis()
    } catch (error) {
      const message = getErrorMessage(error)
      markAiAnalysisStage(analysis, stage, 'failed', message)
      result.stages[stage] = { status: 'failed', error: message }
      await updateAnalysis()
      mlIndexLogger.warn(
        `AI analysis stage ${stage} failed for photo ${photoId}: ${message}`,
      )
    }
  }

  return result
}

export const indexPhotoFaces = async (photoId: string) => {
  const mlEnabled =
    (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
  if (!mlEnabled) return { skipped: true, reason: 'disabled', faces: 0 }

  if (getDatabaseProvider() !== 'postgres') {
    return { skipped: true, reason: 'postgres-required', faces: 0 }
  }

  const faceAlbumEnabled =
    (await settingsManager.get<boolean>('system', 'ml.faceAlbum.enabled')) ??
    false
  if (!faceAlbumEnabled) return { skipped: true, reason: 'disabled', faces: 0 }

  const { photo, image } = await getPhotoAndImageForMachineLearning(photoId)
  const settings = await getMachineLearningSettings()
  const client = createMachineLearningClient(settings)
  const vectorStore = createVectorStore(settings)
  const faceModel = settings.faceModel
  const faces = await client.detectFaces(image, faceModel)

  const existingFaces = await vectorStore.listFacePayloads({
    photoIds: [photo.id],
    includeUnassigned: true,
  })

  const pendingFaces: GeneratedFaceData[] = []
  try {
    for (const [index, face] of faces.entries()) {
      const boundingBox = toBoundingBox(face)
      if (!boundingBox) continue

      const embedding = coerceFaceEmbedding(face.embedding)
      if (embedding.length === 0) continue

      const faceId = stableFaceId(photo.id, index)
      const crop = await generateFaceCrop(photo, faceId, image, boundingBox)
      if (!crop) continue

      pendingFaces.push({
        faceId,
        boundingBox,
        score: face.score ?? null,
        embedding,
        cropStorageKey: crop.cropStorageKey,
        cropWidth: crop.cropWidth,
        cropHeight: crop.cropHeight,
        cropSize: crop.cropSize,
      })
    }
  } catch (error) {
    await cleanupGeneratedFaceCrops(pendingFaces)
    throw error
  }

  await deleteExistingFaceDataForPhoto(photo.id, existingFaces, vectorStore)

  const indexedFaces: GeneratedFaceData[] = []
  try {
    for (const face of pendingFaces) {
      await vectorStore.upsertFaceEmbedding({
        faceId: face.faceId,
        photoId: photo.id,
        ownerUserId: photo.ownerUserId,
        personId: null,
        boundingBox: face.boundingBox,
        score: face.score ?? null,
        cropStorageKey: face.cropStorageKey,
        cropWidth: face.cropWidth,
        cropHeight: face.cropHeight,
        cropSize: face.cropSize,
        modelName: faceModel,
        embedding: face.embedding,
      })
      indexedFaces.push(face)
    }
  } catch (error) {
    await cleanupGeneratedFaceCrops(pendingFaces)
    if (indexedFaces.length > 0) {
      await vectorStore.deleteFaceEmbeddingsForPhoto(photo.id)
    }
    throw error
  }

  return { skipped: false, faces: indexedFaces.length }
}

export const clusterFacesForOwner = async (ownerUserId?: number | null) => {
  if (getDatabaseProvider() !== 'postgres') {
    return { skipped: true, reason: 'postgres-required' }
  }

  const faceAlbumEnabled =
    (await settingsManager.get<boolean>('system', 'ml.faceAlbum.enabled')) ??
    false
  if (!faceAlbumEnabled) return { skipped: true, reason: 'disabled' }

  const threshold =
    (await settingsManager.get<number>('system', 'ml.faceCluster.threshold')) ??
    0.65

  const db = useDB()
  const settings = await getMachineLearningSettings()
  const vectorStore = createVectorStore(settings)
  const faceModel = settings.faceModel
  const rows = await vectorStore.listFaceEmbeddings(ownerUserId, faceModel)
  if (rows.length === 0) return { skipped: false, people: 0, faces: 0 }

  const preservedPeople = normalizeRows(
    await db.execute(sql`
      select
        people.id as person_id,
        people.owner_user_id,
        people.cover_photo_id
      from people
      where
        ${ownerUserId ? sql`people.owner_user_id = ${ownerUserId}` : sql`true`}
        and (
          people.name is not null
          or people.is_favorite = true
          or people.birth_date is not null
        )
      order by people.owner_user_id asc, people.id asc
    `),
  )
  const preservedPersonIds = new Set(
    preservedPeople.map((person) => Number(person.person_id)).filter(Boolean),
  )

  const ownerIds = Array.from(
    new Set(rows.map((row) => Number(row.ownerUserId)).filter(Boolean)),
  )

  type Cluster = {
    personId: number
    ownerUserId: number
    coverPhotoId: string
    centroid: number[]
    count: number
  }

  const clustersByOwner = new Map<number, Cluster[]>()
  const existingClusters = new Map<number, Cluster>()
  const preservedById = new Map(
    preservedPeople.map((person) => [Number(person.person_id), person]),
  )
  for (const row of rows) {
    const ownerId = Number(row.ownerUserId)
    const personId = Number(row.personId)
    if (!ownerId || !personId || !preservedPersonIds.has(personId)) continue
    const embedding = row.embedding || []
    if (embedding.length === 0) continue

    let cluster = existingClusters.get(personId)
    if (!cluster) {
      const preserved = preservedById.get(personId)
      cluster = {
        personId,
        ownerUserId: ownerId,
        coverPhotoId: preserved?.cover_photo_id || row.photoId,
        centroid: [...embedding],
        count: 0,
      }
      existingClusters.set(personId, cluster)
      const clusters = clustersByOwner.get(ownerId) || []
      clusters.push(cluster)
      clustersByOwner.set(ownerId, clusters)
    } else {
      cluster.centroid = cluster.centroid.map((value, index) => {
        const nextValue = embedding[index] ?? value
        return (value * cluster!.count + nextValue) / (cluster!.count + 1)
      })
    }
    cluster.count += 1
  }

  for (const id of ownerIds) {
    await db.execute(sql`
      delete from people
      where
        owner_user_id = ${id}
        and name is null
        and is_favorite = false
        and birth_date is null
    `)
  }
  let assignedFaces = 0

  for (const row of rows) {
    const ownerId = Number(row.ownerUserId)
    const faceId = Number(row.faceId)
    const embedding = row.embedding || []
    if (!ownerId || embedding.length === 0) continue

    const clusters = clustersByOwner.get(ownerId) || []
    let best: Cluster | null = null
    let bestScore = -1
    for (const cluster of clusters) {
      const score = cosineSimilarity(embedding, cluster.centroid)
      if (score > bestScore) {
        bestScore = score
        best = cluster
      }
    }

    if (!best || bestScore < threshold) {
      const inserted = await db.execute(sql`
        insert into people (
          owner_user_id,
          cover_photo_id,
          is_hidden,
          created_at,
          updated_at
        )
        values (
          ${ownerId},
          ${row.photoId},
          false,
          now(),
          now()
        )
        returning id
      `)
      const personId = Number(normalizeRows(inserted)[0]?.id)
      if (!personId) continue

      best = {
        personId,
        ownerUserId: ownerId,
        coverPhotoId: row.photoId,
        centroid: [...embedding],
        count: 0,
      }
      clusters.push(best)
      clustersByOwner.set(ownerId, clusters)
    } else {
      best.centroid = best.centroid.map((value, index) => {
        const nextValue = embedding[index] ?? value
        return (value * best!.count + nextValue) / (best!.count + 1)
      })
    }

    best.count += 1
    assignedFaces += 1
    await vectorStore.setFacePersonId(faceId, best.personId)
  }

  return {
    skipped: false,
    people: Array.from(clustersByOwner.values()).reduce(
      (sum, clusters) => sum + clusters.length,
      0,
    ),
    faces: assignedFaces,
  }
}

export const indexPhotoWithMachineLearning = async (photoId: string) => {
  const mlEnabled =
    (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false
  if (!mlEnabled) return { skipped: true, reason: 'disabled' }

  if (getDatabaseProvider() !== 'postgres') {
    return { skipped: true, reason: 'postgres-required' }
  }

  const stages: {
    autoTags: MachineLearningStageResult
    semanticEmbedding: MachineLearningStageResult
    description: MachineLearningStageResult
    faces: MachineLearningStageResult
  } = {
    autoTags: { status: 'skipped', reason: 'not-run', tags: 0 },
    semanticEmbedding: {
      status: 'skipped',
      reason: 'not-run',
      embeddingDim: 0,
    },
    description: {
      status: 'skipped',
      reason: 'not-run',
      description: false,
    },
    faces: { status: 'skipped', reason: 'not-run', faces: 0 },
  }

  try {
    const result = await indexPhotoAutoTags(photoId)
    stages.autoTags = {
      status: result.skipped ? 'skipped' : 'success',
      reason: result.skipped ? result.reason : undefined,
      tags: result.tags,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    stages.autoTags = { status: 'failed', error: message, tags: 0 }
    mlIndexLogger.warn(
      `Auto tag/VLM stage failed for photo ${photoId}: ${message}`,
    )
  }

  try {
    const result = await indexPhotoSemanticEmbedding(photoId)
    stages.semanticEmbedding = {
      status: result.skipped ? 'skipped' : 'success',
      reason: result.skipped ? result.reason : undefined,
      embeddingDim: result.skipped ? 0 : result.embeddingDim,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    stages.semanticEmbedding = {
      status: 'failed',
      error: message,
      embeddingDim: 0,
    }
    mlIndexLogger.warn(
      `Semantic embedding stage failed for photo ${photoId}: ${message}`,
    )
  }

  try {
    const result = await indexPhotoAiAnalysis(photoId)
    stages.description = {
      status: result.skipped ? 'skipped' : 'success',
      reason: result.skipped ? result.reason : undefined,
      description: !result.skipped,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    stages.description = {
      status: 'failed',
      error: message,
      description: false,
    }
    mlIndexLogger.warn(
      `AI description stage failed for photo ${photoId}: ${message}`,
    )
  }

  try {
    const faceResult = await indexPhotoFaces(photoId)
    stages.faces = {
      status: faceResult.skipped ? 'skipped' : 'success',
      reason: faceResult.skipped ? faceResult.reason : undefined,
      faces: faceResult.faces,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    stages.faces = { status: 'failed', error: message, faces: 0 }
    mlIndexLogger.warn(
      `Face indexing stage failed for photo ${photoId}: ${message}`,
    )
    throw error
  }

  return {
    skipped: false,
    photoId,
    embeddingDim: stages.semanticEmbedding.embeddingDim ?? 0,
    autoTagCount: stages.autoTags.tags ?? 0,
    faceCount: stages.faces.faces ?? 0,
    autoTags: stages.autoTags,
    semanticEmbedding: stages.semanticEmbedding,
    description: stages.description,
    faces: stages.faces,
  }
}
