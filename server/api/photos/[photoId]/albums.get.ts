import { eq } from 'drizzle-orm'
import z from 'zod'

export default eventHandler(async (event) => {
  const { photoId } = await getValidatedRouterParams(
    event,
    z.object({
      photoId: z.string(),
    }).parse,
  )

  const db = useDB()
  const session = await getUserSession(event)
  const isAdmin = isAdminUser(session.user)

  // 获取包含该照片的所有相册
  const albums = await db
    .select({
      id: tables.albums.id,
      title: tables.albums.title,
      description: tables.albums.description,
      coverPhotoId: tables.albums.coverPhotoId,
      isHidden: tables.albums.isHidden,
      createdAt: tables.albums.createdAt,
      updatedAt: tables.albums.updatedAt,
    })
    .from(tables.albums)
    .innerJoin(
      tables.albumPhotos,
      eq(tables.albums.id, tables.albumPhotos.albumId),
    )
    .where(eq(tables.albumPhotos.photoId, photoId))
    .all()

  return isAdmin ? albums : albums.filter((album) => !album.isHidden)
})
