import { eq } from 'drizzle-orm'
import { serializeAdminPhoto } from '~~/server/utils/security'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const photoId = getRouterParam(event, 'photoId')

  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
    })
  }

  const photo = await useDB()
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
      statusMessage: 'Cannot read another user photo',
    })
  }

  return {
    photo: serializeAdminPhoto(photo),
  }
})
