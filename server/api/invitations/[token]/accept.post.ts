import { z } from 'zod'
import {
  getInvitationStatus,
  hashInvitationToken,
} from '~~/server/utils/invitations'
import {
  ensureUserPublicProfile,
  getUniqueUsername,
  prepareNewUserRecord,
} from '~~/server/utils/users'
import { getAuthCookieOptions } from '~~/server/utils/auth-cookie'

const bodySchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6),
})

export default eventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invitation token is required',
    })
  }

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDB()
  const invite = await db
    .select()
    .from(tables.userInvites)
    .where(eq(tables.userInvites.tokenHash, hashInvitationToken(token)))
    .get()

  if (!invite || getInvitationStatus(invite) !== 'pending') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invitation is invalid or expired',
    })
  }

  const user = await db.transaction(async (tx: any) => {
    const existingUser = await tx
      .select()
      .from(tables.users)
      .where(eq(tables.users.email, invite.email))
      .get()

    if (existingUser && !isDisabledUser(existingUser)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'User with this email already exists',
      })
    }

    const username = await getUniqueUsername(
      tx,
      body.username,
      existingUser?.id,
    )
    const now = new Date()
    const userData = {
      username,
      email: invite.email,
      password: await hashPassword(body.password),
      role: invite.role,
      isAdmin: invite.role === 'admin' ? 1 : 0,
      disabledAt: null,
    }

    const acceptedUser = existingUser
      ? await tx
          .update(tables.users)
          .set(userData)
          .where(eq(tables.users.id, existingUser.id))
          .returning()
          .get()
      : await tx
          .insert(tables.users)
          .values(
            await prepareNewUserRecord(tx, {
              ...userData,
              createdAt: now,
            }),
          )
          .returning()
          .get()

    await ensureUserPublicProfile(tx, acceptedUser)

    await tx
      .update(tables.userInvites)
      .set({
        acceptedAt: now,
        acceptedByUserId: acceptedUser.id,
      })
      .where(eq(tables.userInvites.id, invite.id))
      .run()

    return acceptedUser
  })

  await setUserSession(
    event,
    { user: sanitizeSessionUser(user) },
    {
      cookie: {
        ...getAuthCookieOptions(event),
      },
    },
  )

  return sanitizeSessionUser(user)
})
