import { z } from 'zod'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)

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

  // 检查相簌是否存在
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

  if (!canManageOwnedResource(session.user, album.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot delete another user album',
    })
  }

  const affectedPhotoIds = (
    await db
      .select({ photoId: tables.albumPhotos.photoId })
      .from(tables.albumPhotos)
      .where(eq(tables.albumPhotos.albumId, albumId))
      .all()
  ).map((row) => row.photoId)

  // 使用事务删除相簌及其关联的照片关系
  await db.transaction(async (tx) => {
    // 删除相簌-照片关系
    await tx
      .delete(tables.albumPhotos)
      .where(eq(tables.albumPhotos.albumId, albumId))
      .run()

    // 删除相簌
    await tx.delete(tables.albums).where(eq(tables.albums.id, albumId)).run()
  })

  await syncPhotoVisibility(affectedPhotoIds)

  return { success: true }
})
