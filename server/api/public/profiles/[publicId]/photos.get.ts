import { and, desc, eq, getTableColumns } from 'drizzle-orm'
import { canViewOwnerPrivateContent } from '~~/server/utils/public-profile'

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

  const photos = await db
    .select({
      ...getTableColumns(tables.photos),
      ownerId: tables.users.id,
      ownerUsername: tables.users.username,
      ownerAvatar: tables.users.avatar,
    })
    .from(tables.photos)
    .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))
    .where(
      isOwner
        ? eq(tables.photos.ownerUserId, user.id)
        : and(
            eq(tables.photos.ownerUserId, user.id),
            eq(tables.photos.visibility, 'public'),
          ),
    )
    .orderBy(desc(tables.photos.dateTaken))
    .all()

  return photos.map(isOwner ? serializeAdminPhoto : serializePublicPhoto)
})
