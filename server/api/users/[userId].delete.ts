import { and, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  getPhotoStorageKeys,
  getUserOwnedPhotoStorageKeys,
} from '~~/server/utils/photo-delete'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

const paramsSchema = z.object({
  userId: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value)),
})

export default eventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const { userId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDB()

  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  const restrictions = getUserDeletionRestrictions(
    session.user,
    user,
    await getActiveAdminCount(db),
  )

  if (restrictions.isSelf) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete the current user',
    })
  }

  if (restrictions.isLastActiveAdmin) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete the last active admin',
    })
  }

  const photos = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.ownerUserId, userId))
    .all()
  const albums = await db
    .select()
    .from(tables.albums)
    .where(eq(tables.albums.ownerUserId, userId))
    .all()

  const storageKeys = [
    ...new Set(
      photos.flatMap((photo: any) =>
        getUserOwnedPhotoStorageKeys(photo, userId),
      ),
    ),
  ]
  const skippedStorageFiles = [
    ...new Set(photos.flatMap(getPhotoStorageKeys)),
  ].filter((key: string) => !storageKeys.includes(key)).length

  const queueItems = await db.select().from(tables.pipelineQueue).all()
  const deletedQueueIds = queueItems
    .filter((item: any) => {
      const payload = item.payload || {}
      return (
        isSameUserId(payload.ownerUserId, userId) ||
        photos.some((p: any) => p.id === payload.photoId)
      )
    })
    .map((item: any) => item.id)

  await db.transaction(async (tx: any) => {
    for (const album of albums) {
      await tx
        .delete(tables.albumPhotos)
        .where(eq(tables.albumPhotos.albumId, album.id))
        .run()
    }

    await tx
      .delete(tables.albums)
      .where(eq(tables.albums.ownerUserId, userId))
      .run()

    await tx
      .delete(tables.photos)
      .where(eq(tables.photos.ownerUserId, userId))
      .run()

    for (const taskId of deletedQueueIds) {
      await tx
        .delete(tables.pipelineQueue)
        .where(eq(tables.pipelineQueue.id, taskId))
        .run()
    }

    await tx
      .delete(tables.userInvites)
      .where(
        or(
          eq(tables.userInvites.email, user.email),
          eq(tables.userInvites.createdByUserId, userId),
          eq(tables.userInvites.acceptedByUserId, userId),
        ),
      )
      .run()

    await tx.delete(tables.users).where(eq(tables.users.id, userId)).run()
  })

  const { storageProvider } = useStorageProvider(event)
  const fileDeleteErrors = []
  for (const key of storageKeys) {
    try {
      await storageProvider.delete(key)
    } catch (error) {
      fileDeleteErrors.push({
        key,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    ok: true,
    deleted: {
      userId,
      photos: photos.length,
      albums: albums.length,
      queueTasks: deletedQueueIds.length,
      storageFiles: storageKeys.length - fileDeleteErrors.length,
      skippedStorageFiles,
      fileDeleteErrors,
    },
  }
})

async function getActiveAdminCount(db: any) {
  return (
    await db
      .select()
      .from(tables.users)
      .where(
        and(eq(tables.users.role, 'admin'), isNull(tables.users.disabledAt)),
      )
      .all()
  ).length
}
