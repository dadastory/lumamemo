import { createHash, randomBytes } from 'node:crypto'

type InvitationLike = {
  expiresAt: Date | string | number | null
  acceptedAt?: Date | string | number | null
  revokedAt?: Date | string | number | null
}

export const DEFAULT_INVITE_EXPIRES_IN_DAYS = 7

export const generateInvitationToken = () => randomBytes(32).toString('base64url')

export const hashInvitationToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

const toDate = (value: Date | string | number | null | undefined) => {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

export const normalizeInviteExpiry = (
  value?: string | Date | null,
  now = new Date(),
) => {
  if (value) {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime()) || date <= now) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation expiry must be in the future',
      })
    }
    return date
  }

  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_INVITE_EXPIRES_IN_DAYS)
  return expiresAt
}

export const getInvitationStatus = (
  invite: InvitationLike,
  now = new Date(),
) => {
  if (toDate(invite.revokedAt)) return 'revoked'
  if (toDate(invite.acceptedAt)) return 'accepted'

  const expiresAt = toDate(invite.expiresAt)
  if (expiresAt && expiresAt <= now) return 'expired'
  return 'pending'
}

export const buildInviteUrl = (origin: string, token: string) =>
  `${origin.replace(/\/+$/, '')}/invite/${encodeURIComponent(token)}`

export const serializeInvitation = (invite: Record<string, any>) => ({
  id: invite.id,
  email: invite.email,
  role: invite.role || 'user',
  expiresAt: invite.expiresAt,
  acceptedAt: invite.acceptedAt ?? null,
  acceptedByUserId: invite.acceptedByUserId ?? null,
  createdByUserId: invite.createdByUserId ?? null,
  createdAt: invite.createdAt,
  revokedAt: invite.revokedAt ?? null,
  status: getInvitationStatus(invite),
})
