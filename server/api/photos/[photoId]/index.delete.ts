import { deletePhotoFiles } from '~~/server/utils/photo-delete'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const { storageProvider } = useStorageProvider(event)
  const photoId = getRouterParam(event, 'photoId')

  if (!photoId) {
    return createError({
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
    return createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot delete another user photo',
    })
  }

  logger.image.info(`Deleting photo ${photo.title || photo.id || photoId}`)

  const photoAssets = await useDB()
    .select()
    .from(tables.photoAssets)
    .where(eq(tables.photoAssets.photoId, photoId))
    .all()

  if (photo.storageKey) {
    logger.image.info(`Deleting photo files for ${photoId} from storage`)
    await deletePhotoFiles(
      storageProvider,
      { ...photo, photoAssets },
      { strict: false },
    )
  }

  await useDB().delete(tables.photos).where(eq(tables.photos.id, photoId)).run()

  logger.image.success(`Photo ${photoId} deleted`)

  return {
    statusCode: 200,
    statusMessage: 'Photo deleted successfully',
  }
})
