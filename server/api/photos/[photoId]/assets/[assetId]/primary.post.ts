import { and, eq } from 'drizzle-orm'
import { serializeAdminPhoto } from '~~/server/utils/security'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const photoId = getRouterParam(event, 'photoId')
  const assetId = Number(getRouterParam(event, 'assetId'))

  if (!photoId || !Number.isSafeInteger(assetId) || assetId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID and asset ID are required',
    })
  }

  const db = useDB()
  const photo = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot update another user photo assets',
    })
  }

  const asset = await db
    .select()
    .from(tables.photoAssets)
    .where(
      and(
        eq(tables.photoAssets.id, assetId),
        eq(tables.photoAssets.photoId, photoId),
      ),
    )
    .get()

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset not found',
    })
  }

  await db
    .update(tables.photoAssets)
    .set({ isPrimary: false })
    .where(eq(tables.photoAssets.photoId, photoId))
    .run()
  await db
    .update(tables.photoAssets)
    .set({ isPrimary: true })
    .where(eq(tables.photoAssets.id, assetId))
    .run()
  await db
    .update(tables.photos)
    .set({
      sourceType: 'raw',
      displayStorageKey: asset.storageKey,
      displayMimeType: asset.mimeType,
      displayFileSize: asset.fileSize,
      displayWidth: asset.width,
      displayHeight: asset.height,
      width: asset.width,
      height: asset.height,
      aspectRatio: asset.width / asset.height,
      originalUrl: null,
      thumbnailKey: null,
      thumbnailUrl: null,
      thumbnailHash: null,
      imageVariants: null,
      lastModified: new Date().toISOString(),
    })
    .where(eq(tables.photos.id, photoId))
    .run()

  const workerPool = globalThis.__workerPool
  let taskId: number | null = null
  if (workerPool) {
    taskId = await workerPool.addTask(
      { type: 'photo-variants', photoId, ownerUserId: photo.ownerUserId },
      { priority: 2, maxAttempts: 3 },
    )
  } else {
    logger.image.warn(
      `Worker pool not initialized, skipping variant rebuild for ${photoId}`,
    )
  }

  const updatedPhoto = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  return {
    success: true,
    taskId,
    photo: serializeAdminPhoto(updatedPhoto),
  }
})
