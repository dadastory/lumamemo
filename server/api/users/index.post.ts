import { z } from 'zod'
import {
  ensureUserPublicProfile,
  prepareNewUserRecord,
} from '~~/server/utils/users'

export default eventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readValidatedBody(
    event,
    z.object({
      email: z.email(),
      username: z.string().min(2).max(64),
      password: z.string().min(6),
      role: z.enum(['admin', 'user']).default('user'),
      disabled: z.boolean().optional().default(false),
    }).parse,
  )

  const now = new Date()
  const db = useDB()
  const user = await db
    .insert(tables.users)
    .values(
      await prepareNewUserRecord(db, {
        email: body.email,
        username: body.username,
        password: await hashPassword(body.password),
        role: body.role,
        isAdmin: body.role === 'admin' ? 1 : 0,
        disabledAt: body.disabled ? now : null,
        createdAt: now,
      }),
    )
    .returning()
    .get()

  await ensureUserPublicProfile(db, user)

  return sanitizeSessionUser(user)
})
