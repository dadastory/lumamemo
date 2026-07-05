import { asc, eq } from 'drizzle-orm'
import { serializePhotoAsset } from '~~/server/utils/raw-photo'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const photoId = getRouterParam(event, 'photoId')
  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
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
      statusMessage: 'Cannot view another user photo assets',
    })
  }

  const assets = await db
    .select()
    .from(tables.photoAssets)
    .where(eq(tables.photoAssets.photoId, photoId))
    .orderBy(asc(tables.photoAssets.createdAt), asc(tables.photoAssets.id))
    .all()

  return {
    assets: assets.map((asset) =>
      serializePhotoAsset(asset, { includeStorageKey: true }),
    ),
  }
})
