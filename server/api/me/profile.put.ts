import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  displayName: z.string().min(1).max(80),
  profileTitle: z.string().max(120).nullable().optional(),
  profileSlogan: z.string().max(240).nullable().optional(),
  profileBio: z.string().max(1000).nullable().optional(),
  avatar: z.string().max(1000).nullable().optional(),
  homepageVisibility: z.enum(['private', 'public']),
})

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDB()

  const user = await db
    .update(tables.users)
    .set({
      displayName: body.displayName,
      profileTitle: body.profileTitle || null,
      profileSlogan: body.profileSlogan || null,
      profileBio: body.profileBio || null,
      avatar: body.avatar || null,
      homepageVisibility: body.homepageVisibility,
    })
    .where(eq(tables.users.id, session.user.id))
    .returning()
    .get()

  return sanitizeSessionUser(user)
})
