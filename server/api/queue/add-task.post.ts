import { z } from 'zod'

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
      }),
      z.object({
        type: z.literal('photo-erase-location'),
        photoId: z.string().min(1),
      }),
      z.object({
        type: z.literal('photo-variants'),
        photoId: z.string().min(1),
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

    if (!isAdminUser(session.user)) {
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
        payload.type === 'photo-variants'
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
      }
    }

    if (payload.type === 'photo' || payload.type === 'live-photo-video') {
      const ownerUserId = isAdminUser(session.user)
        ? await resolvePayloadOwnerUserId(payload)
        : session.user.id

      if (ownerUserId === null) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Unable to resolve upload owner',
        })
      }

      payload.ownerUserId = ownerUserId
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
