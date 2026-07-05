import { and, eq } from 'drizzle-orm'

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

  if (photo.sourceType !== 'raw') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only RAW photo versions can be deleted here',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot delete another user photo assets',
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

  if (asset.isPrimary || asset.storageKey === photo.displayStorageKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete the current primary RAW display image',
    })
  }

  await db
    .delete(tables.photoAssets)
    .where(eq(tables.photoAssets.id, assetId))
    .run()

  const { storageProvider } = useStorageProvider(event)
  try {
    await storageProvider.delete(asset.storageKey)
  } catch (error) {
    logger.image.warn(
      `Failed to delete RAW version asset storage object ${asset.storageKey}`,
      error,
    )
  }

  return {
    success: true,
    assetId,
  }
})
