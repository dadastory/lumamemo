import { getInvitationStatus, hashInvitationToken } from '~~/server/utils/invitations'

export default eventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invitation token is required',
    })
  }

  const invite = await useDB()
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

  return {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  }
})
