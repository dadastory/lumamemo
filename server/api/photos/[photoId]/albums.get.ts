import { and, eq } from 'drizzle-orm'
import z from 'zod'

export default eventHandler(async (event) => {
  const { photoId } = await getValidatedRouterParams(
    event,
    z.object({
      photoId: z.string(),
    }).parse,
  )

  const db = useDB()
  const session = await getSafeUserSession(event)
  if (!session.user) return []

  // 获取包含该照片的所有相册
  const albums = await db
    .select({
      id: tables.albums.id,
      title: tables.albums.title,
      description: tables.albums.description,
      coverPhotoId: tables.albums.coverPhotoId,
      ownerUserId: tables.albums.ownerUserId,
      isHidden: tables.albums.isHidden,
      createdAt: tables.albums.createdAt,
      updatedAt: tables.albums.updatedAt,
    })
    .from(tables.albums)
    .innerJoin(
      tables.albumPhotos,
      eq(tables.albums.id, tables.albumPhotos.albumId),
    )
    .where(
      and(
        eq(tables.albumPhotos.photoId, photoId),
        eq(tables.albums.ownerUserId, session.user.id),
      ),
    )
    .all()

  return albums
})
