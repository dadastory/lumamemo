import { and, eq } from 'drizzle-orm'
import {
  canViewOwnerPrivateContent,
  shouldExposeAlbumToViewer,
} from '~~/server/utils/public-profile'

export default eventHandler(async (event) => {
  const publicId = getRouterParam(event, 'publicId')
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public profile ID is required',
    })
  }

  const db = useDB()
  const session = await getSafeUserSession(event)
  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.publicId, publicId))
    .get()

  const isOwner = canViewOwnerPrivateContent(session.user, user?.id)
  if (
    !user ||
    isDisabledUser(user) ||
    (user.homepageVisibility !== 'public' && !isOwner)
  ) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const albums = await db
    .select()
    .from(tables.albums)
    .where(eq(tables.albums.ownerUserId, user.id))
    .all()

  return await Promise.all(
    albums
      .filter((album: any) =>
        shouldExposeAlbumToViewer(album, session.user, user.id),
      )
      .map(async (album: any) => {
        const photoIds = await db
          .select({
            photoId: tables.albumPhotos.photoId,
          })
          .from(tables.albumPhotos)
          .innerJoin(
            tables.photos,
            eq(tables.albumPhotos.photoId, tables.photos.id),
          )
          .where(
            isOwner
              ? eq(tables.albumPhotos.albumId, album.id)
              : and(
                  eq(tables.albumPhotos.albumId, album.id),
                  eq(tables.photos.visibility, 'public'),
                ),
          )
          .all()

        return serializePublicAlbum({
          ...album,
          photoIds: photoIds.map((row: any) => row.photoId),
        })
      }),
  )
})
