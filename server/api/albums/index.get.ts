export default eventHandler(async (event) => {
  const db = useDB()
  const session = await getUserSession(event)
  const isAdmin = isAdminUser(session.user)
  const hiddenPhotoIds = isAdmin ? [] : await getHiddenPhotoIds()

  const albumsQuery = db.select().from(tables.albums)
  const albums = isAdmin
    ? await albumsQuery
    : await albumsQuery.where(eq(tables.albums.isHidden, false))

  // 为每个相册获取照片 ID 列表（避免循环引用）
  const albumsWithPhotoIds = await Promise.all(
    albums.map(async (album) => {
      const photoIds = await db
        .select({
          photoId: tables.albumPhotos.photoId,
          position: tables.albumPhotos.position,
        })
        .from(tables.albumPhotos)
        .where(eq(tables.albumPhotos.albumId, album.id))
        .orderBy(tables.albumPhotos.position)

      const visiblePhotoIds = photoIds
        .map((p) => p.photoId)
        .filter((photoId) => isAdmin || !hiddenPhotoIds.includes(photoId))

      const serializedAlbum = isAdmin ? album : serializePublicAlbum(album)
      if (
        !isAdmin &&
        serializedAlbum.coverPhotoId &&
        hiddenPhotoIds.includes(serializedAlbum.coverPhotoId)
      ) {
        serializedAlbum.coverPhotoId = null
      }

      return {
        ...serializedAlbum,
        // 即使是空相册，也返回空数组而不是 undefined
        photoIds: visiblePhotoIds,
      }
    }),
  )

  // 按创建时间倒序排列
  return albumsWithPhotoIds.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})
