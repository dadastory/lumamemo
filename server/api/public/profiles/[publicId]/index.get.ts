import { eq } from 'drizzle-orm'
import {
  canViewOwnerPrivateContent,
  serializePublicProfile,
} from '~~/server/utils/public-profile'

export default eventHandler(async (event) => {
  const publicId = getRouterParam(event, 'publicId')
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public profile ID is required',
    })
  }

  const session = await getSafeUserSession(event)
  const user = await useDB()
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

  return serializePublicProfile(user)
})
