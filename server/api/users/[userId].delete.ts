import { and, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  getPhotoStorageKeys,
  getUserOwnedPhotoStorageKeys,
} from '~~/server/utils/photo-delete'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import { getDatabaseProvider } from '~~/server/utils/db'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'
import { logger } from '~~/server/utils/logger'
import { people as postgresPeople } from '~~/server/database/schema/postgres'

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

  const vectorStore =
    getDatabaseProvider() === 'postgres' ? await getVectorStore() : null
  const vectorFaces = vectorStore
    ? await vectorStore
        .listFacePayloads({ ownerUserId: userId, includeUnassigned: true })
        .catch((error) => {
          logger.image.warn(
            `Failed to list vector face payloads for user ${userId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
          return []
        })
    : []
  const photoFacesByPhotoId = new Map<string, typeof vectorFaces>()
  for (const face of vectorFaces) {
    const list = photoFacesByPhotoId.get(face.photoId) || []
    list.push(face)
    photoFacesByPhotoId.set(face.photoId, list)
  }
  const photosWithVectorFaces = photos.map((photo: any) => ({
    ...photo,
    photoFaces: photoFacesByPhotoId.get(photo.id) || [],
  }))

  const storageKeys = [
    ...new Set(
      photosWithVectorFaces.flatMap((photo: any) =>
        getUserOwnedPhotoStorageKeys(photo, userId),
      ),
    ),
  ]
  const skippedStorageFiles = [
    ...new Set(photosWithVectorFaces.flatMap(getPhotoStorageKeys)),
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
  const isPostgres = getDatabaseProvider() === 'postgres'
  const peopleRows = isPostgres
    ? await db
        .select()
        .from(postgresPeople)
        .where(eq(postgresPeople.ownerUserId, userId))
        .all()
    : []

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

    if (isPostgres) {
      await tx
        .delete(postgresPeople)
        .where(eq(postgresPeople.ownerUserId, userId))
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

  if (vectorStore) {
    await Promise.all(
      photos.map(async (photo: any) => {
        try {
          await Promise.all([
            vectorStore.deletePhotoEmbeddings(photo.id),
            vectorStore.deleteFaceEmbeddingsForPhoto(photo.id),
          ])
        } catch (error) {
          logger.image.warn(
            `Failed to delete vector data for photo ${photo.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }),
    )
  }

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
      people: peopleRows.length,
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
