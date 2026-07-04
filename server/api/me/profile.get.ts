import { eq } from 'drizzle-orm'
import { ensureUserPublicProfile } from '~~/server/utils/users'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const db = useDB()
  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, session.user.id))
    .get()

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  const profileUser = await ensureUserPublicProfile(db, user)

  return sanitizeSessionUser(profileUser)
})
