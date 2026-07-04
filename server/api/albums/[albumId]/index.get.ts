import { asc, getTableColumns } from 'drizzle-orm'
import z from 'zod'

export default eventHandler(async (event) => {
  const { albumId } = await getValidatedRouterParams(
    event,
    z.object({
      albumId: z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    }).parse,
  )

  const db = useDB()
  const session = await requireActiveUserSession(event)

  const album = await db
    .select()
    .from(tables.albums)
    .where(eq(tables.albums.id, albumId))
    .get()

  if (!album) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Album not found',
    })
  }

  const canManageAlbum = canManageOwnedResource(session.user, album.ownerUserId)
  if (!canManageAlbum) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot access another user album',
    })
  }

  // 获取相册中的照片
  const albumPhotos = await db
    // all fields from tables.photos
    .select({
      ...getTableColumns(tables.photos),
      ownerId: tables.users.id,
      ownerUsername: tables.users.username,
      ownerAvatar: tables.users.avatar,
    })
    .from(tables.photos)
    .innerJoin(
      tables.albumPhotos,
      eq(tables.photos.id, tables.albumPhotos.photoId),
    )
    .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))
    .where(eq(tables.albumPhotos.albumId, albumId))
    .orderBy(asc(tables.albumPhotos.position))
    .all()
  const photos = albumPhotos

  // 验证相册数据完整性
  if (!photos || !Array.isArray(photos)) {
    // 空相册也是合法的，只需要返回空数组
    return {
      ...album,
      photos: [],
    }
  }

  return {
    ...album,
    photos: canManageAlbum
      ? photos.map(serializeAdminPhoto)
      : photos.map(serializePublicPhoto),
  }
})
