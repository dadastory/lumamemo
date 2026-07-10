import { z } from 'zod'
import {
  assertMachineLearningQueuePayloadEnabled,
  isMachineLearningQueuePayload,
} from '~~/server/utils/ml-queue'

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

    const { tasks, defaultPriority, defaultMaxAttempts } =
      await readValidatedBody(
        event,
        z.object({
          tasks: z
            .array(
              z.object({
                payload: payloadSchema,
                priority: z.number().min(0).max(9).optional(),
                maxAttempts: z.number().min(1).max(5).optional(),
              }),
            )
            .min(1, 'At least one task is required')
            .max(1000, 'Too many tasks: maximum 1000 tasks per batch'),
          defaultPriority: z.number().min(0).max(9).optional().default(0),
          defaultMaxAttempts: z.number().min(1).max(5).optional().default(3),
        }).parse,
      )

    const workerPool = globalThis.__workerPool

    if (!workerPool) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Worker pool not initialized',
      })
    }

    const results = []
    const errors = []

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      try {
        if (
          (task.payload.type === 'photo' ||
            task.payload.type === 'live-photo-video') &&
          !isStorageKeyInUserNamespace(task.payload.storageKey, session.user.id)
        ) {
          throw new Error('Cannot process another user upload')
        }

        if (
          task.payload.type === 'photo-reverse-geocoding' ||
          task.payload.type === 'photo-erase-location' ||
          task.payload.type === 'photo-variants' ||
          task.payload.type === 'photo-ml-index' ||
          task.payload.type === 'photo-ml-auto-tags' ||
          task.payload.type === 'photo-ml-semantic-embedding' ||
          task.payload.type === 'photo-ai-analysis' ||
          task.payload.type === 'photo-face-detect'
        ) {
          const photo = await useDB()
            .select()
            .from(tables.photos)
            .where(eq(tables.photos.id, task.payload.photoId))
            .get()

          if (!canManageOwnedResource(session.user, photo?.ownerUserId)) {
            throw new Error('Cannot process another user photo')
          }
          task.payload.ownerUserId = photo.ownerUserId
        }

        if (
          task.payload.type === 'photo-ml-backfill' ||
          task.payload.type === 'photo-face-cluster'
        ) {
          task.payload.ownerUserId = session.user.id
        }

        if (
          task.payload.type === 'photo' ||
          task.payload.type === 'live-photo-video'
        ) {
          const ownerUserId = await resolvePayloadOwnerUserId(task.payload)
          if (ownerUserId === null || ownerUserId !== Number(session.user.id)) {
            throw new Error('Unable to resolve upload owner')
          }

          task.payload.ownerUserId = ownerUserId
        }

        if (isMachineLearningQueuePayload(task.payload)) {
          await assertMachineLearningQueuePayloadEnabled(task.payload)
        }

        const taskId = await workerPool.addTask(task.payload, {
          priority: task.priority ?? defaultPriority,
          maxAttempts: task.maxAttempts ?? defaultMaxAttempts,
        })

        results.push({ index: i, taskId, payload: task.payload, success: true })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : `Task ${i}: Unknown error`
        errors.push({
          index: i,
          payload: task.payload,
          error: errorMessage,
          success: false,
        })
      }
    }

    return {
      success: errors.length === 0,
      totalTasks: tasks.length,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${tasks.length} tasks: ${results.length} successful, ${errors.length} failed`,
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage:
        error instanceof Error ? error.message : 'Failed to add tasks to queue',
    })
  }
})
