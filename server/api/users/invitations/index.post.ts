import { z } from 'zod'
import {
  buildInviteUrl,
  generateInvitationToken,
  hashInvitationToken,
  normalizeInviteExpiry,
  serializeInvitation,
} from '~~/server/utils/invitations'

const bodySchema = z.object({
  email: z.email(),
  role: z.enum(['admin', 'user']).default('user'),
  expiresAt: z.string().datetime().optional(),
})

export default eventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDB()
  const email = body.email.trim().toLowerCase()

  const existingEnabledUser = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .get()

  if (existingEnabledUser && !isDisabledUser(existingEnabledUser)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'User with this email already exists',
    })
  }

  const token = generateInvitationToken()
  const invite = await db
    .insert(tables.userInvites)
    .values({
      email,
      tokenHash: hashInvitationToken(token),
      role: body.role,
      expiresAt: normalizeInviteExpiry(body.expiresAt),
      createdByUserId: session.user.id,
    })
    .returning()
    .get()

  const origin = getRequestURL(event).origin
  return {
    ...serializeInvitation(invite),
    inviteUrl: buildInviteUrl(origin, token),
  }
})
