import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import {
  MAX_USER_STORAGE_QUOTA_GB,
  MIN_USER_STORAGE_QUOTA_GB,
  quotaGbToBytes,
} from '~~/server/services/storage/quota'

const storageQuotaGBSchema = z
  .number()
  .min(MIN_USER_STORAGE_QUOTA_GB)
  .max(MAX_USER_STORAGE_QUOTA_GB)
  .nullable()
  .optional()

const paramsSchema = z.object({
  userId: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value)),
})

const bodySchema = z.object({
  email: z.email().optional(),
  username: z.string().min(2).max(64).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional(),
  disabled: z.boolean().optional(),
  storageQuotaGB: storageQuotaGBSchema,
})

export default eventHandler(async (event) => {
  await requireAdminSession(event)
  const { userId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDB()

  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  const activeAdminCount = (
    await db
    .select()
    .from(tables.users)
    .where(and(eq(tables.users.role, 'admin'), isNull(tables.users.disabledAt)))
    .all()
  ).length

  const wouldRemoveAdmin =
    user.role === 'admin' &&
    ((body.role && body.role !== 'admin') || body.disabled === true)

  if (wouldRemoveAdmin && activeAdminCount <= 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot remove the last active admin',
    })
  }

  const updateData: Record<string, any> = {}

  if (body.email !== undefined) updateData.email = body.email
  if (body.username !== undefined) updateData.username = body.username
  if (body.password !== undefined) {
    updateData.password = await hashPassword(body.password)
  }
  if (body.role !== undefined) {
    updateData.role = body.role
    updateData.isAdmin = body.role === 'admin' ? 1 : 0
  }
  if (body.disabled !== undefined) {
    updateData.disabledAt = body.disabled ? new Date() : null
  }
  if (body.storageQuotaGB !== undefined) {
    updateData.storageQuotaBytes =
      body.storageQuotaGB === null ? null : quotaGbToBytes(body.storageQuotaGB)
  }

  const updatedUser = await db
    .update(tables.users)
    .set(updateData)
    .where(eq(tables.users.id, userId))
    .returning()
    .get()

  return sanitizeSessionUser(updatedUser)
})
