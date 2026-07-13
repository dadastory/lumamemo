import { z } from 'zod'
import {
  assertMachineLearningQueuePayloadEnabled,
  isMachineLearningQueuePayload,
} from '~~/server/utils/ml-queue'
import { markPendingUploadQueued } from '~~/server/services/storage/pending-uploads'

const photoAiAnalysisStages = z.enum([
  'tags',
  'description',
  'score',
  'critique',
  'suggestions',
])

const resolvePayloadOwnerUserId = async (payload: {
  storageKey: string
  ownerUserId?: number | null
}) => {
  const existingPhoto = await getPhotoByStorageKey(payload.storageKey)
  return resolvePhotoTaskOwnerUserId({
    storageKey: payload.storageKey,
    existingOwnerUserId: existingPhoto?.ownerUserId,
    explicitOwnerUserId: payload.ownerUserId,
  })
}

export default defineEventHandler(async (event) => {
  const session = await requireActiveUserSession(event)

  try {
    const payloadSchema = z.discriminatedUnion('type', [
      z.object({
        type: z.literal('photo'),
        storageKey: z.string().nonempty(),
        eraseLocation: z.boolean().optional(),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('live-photo-video'),
        storageKey: z.string().nonempty(),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-reverse-geocoding'),
        photoId: z.string().min(1),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-erase-location'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-variants'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
        reindexMlAfterVariants: z.boolean().optional(),
      }),
      z.object({
        type: z.literal('photo-ml-index'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-ml-auto-tags'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-ml-semantic-embedding'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-ai-analysis'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
        stages: z.array(photoAiAnalysisStages).optional(),
      }),
      z.object({
        type: z.literal('photo-face-detect'),
        photoId: z.string().min(1),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-ml-backfill'),
        ownerUserId: z.number().nullable().optional(),
      }),
      z.object({
        type: z.literal('photo-face-cluster'),
        ownerUserId: z.number().nullable().optional(),
      }),
    ])

    const { payload, priority, maxAttempts } = await readValidatedBody(
      event,
      z.object({
        payload: payloadSchema,
        priority: z.number().min(0).max(9).optional().default(0),
        maxAttempts: z.number().min(1).max(5).optional().default(3),
      }).parse,
    )

    if (
      (payload.type === 'photo' || payload.type === 'live-photo-video') &&
      !isStorageKeyInUserNamespace(payload.storageKey, session.user.id)
    ) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot process another user upload',
      })
    }

    if (
      payload.type === 'photo-reverse-geocoding' ||
      payload.type === 'photo-erase-location' ||
      payload.type === 'photo-variants' ||
      payload.type === 'photo-ml-index' ||
      payload.type === 'photo-ml-auto-tags' ||
      payload.type === 'photo-ml-semantic-embedding' ||
      payload.type === 'photo-ai-analysis' ||
      payload.type === 'photo-face-detect'
    ) {
      const photo = await useDB()
        .select()
        .from(tables.photos)
        .where(eq(tables.photos.id, payload.photoId))
        .get()

      if (!canManageOwnedResource(session.user, photo?.ownerUserId)) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Cannot process another user photo',
        })
      }
      payload.ownerUserId = photo.ownerUserId
    }

    if (
      payload.type === 'photo-ml-backfill' ||
      payload.type === 'photo-face-cluster'
    ) {
      payload.ownerUserId = session.user.id
    }

    if (payload.type === 'photo' || payload.type === 'live-photo-video') {
      const ownerUserId = await resolvePayloadOwnerUserId(payload)

      if (ownerUserId === null || ownerUserId !== Number(session.user.id)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Unable to resolve upload owner',
        })
      }

      payload.ownerUserId = ownerUserId
    }

    if (isMachineLearningQueuePayload(payload)) {
      await assertMachineLearningQueuePayloadEnabled(payload)
    }

    const workerPool = globalThis.__workerPool

    if (!workerPool) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Worker pool not initialized',
      })
    }

    const taskId = await workerPool.addTask(payload, {
      priority,
      maxAttempts,
    })

    if (payload.type === 'photo' || payload.type === 'live-photo-video') {
      await markPendingUploadQueued(payload.storageKey, taskId)
    }

    return {
      success: true,
      taskId,
      message: 'Task added to queue successfully',
      payload,
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage:
        error instanceof Error ? error.message : 'Failed to add task to queue',
    })
  }
})
