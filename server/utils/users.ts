import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { tables } from './db'

const normalizeUsernameCandidate = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
  return normalized || 'user'
}

export const getUniqueUsername = async (
  db: any,
  rawCandidate: string,
  ignoreUserId?: number,
) => {
  const base = normalizeUsernameCandidate(rawCandidate).slice(0, 56)
  let candidate = base
  let suffix = 1

  while (true) {
    const existing = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.username, candidate))
      .get()

    if (!existing || existing.id === ignoreUserId) {
      return candidate
    }

    suffix += 1
    candidate = `${base}-${suffix}`.slice(0, 64)
  }
}

const randomPublicId = () => {
  return `p_${randomBytes(12).toString('hex')}`
}

export const getUniquePublicId = async (db: any) => {
  while (true) {
    const publicId = randomPublicId()
    const existing = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.publicId, publicId))
      .get()

    if (!existing) return publicId
  }
}

export const ensureUserPublicProfile = async (db: any, user: any) => {
  if (!user) return null
  const updateData: Record<string, any> = {}

  if (!user.publicId) updateData.publicId = await getUniquePublicId(db)
  if (!user.displayName) updateData.displayName = user.username
  if (!user.homepageVisibility) updateData.homepageVisibility = 'private'

  if (Object.keys(updateData).length === 0) return user

  return await db
    .update(tables.users)
    .set(updateData)
    .where(eq(tables.users.id, user.id))
    .returning()
    .get()
}

export const prepareNewUserRecord = async (
  db: any,
  values: Record<string, any>,
) => {
  const username = values.username
  return {
    ...values,
    publicId: values.publicId || (await getUniquePublicId(db)),
    displayName: values.displayName || username,
    homepageVisibility: values.homepageVisibility || 'private',
  }
}
