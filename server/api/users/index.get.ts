import { asc } from 'drizzle-orm'
import {
  getUserStorageSummary,
  quotaBytesToGb,
} from '~~/server/services/storage/quota'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

export default eventHandler(async (event) => {
  await requireAdminSession(event)
  const { storageProvider } = useStorageProvider(event)

  const users = await useDB()
    .select()
    .from(tables.users)
    .orderBy(asc(tables.users.createdAt))
    .all()

  return await Promise.all(
    users.map(async (user) => {
      const sanitizedUser = sanitizeSessionUser(user)!
      return {
        ...sanitizedUser,
        storageQuotaOverrideBytes: user.storageQuotaBytes ?? null,
        storageQuotaOverrideGB: quotaBytesToGb(user.storageQuotaBytes),
        ...(await getUserStorageSummary(user, {
          storageProvider,
          resolveMissingSizes: false,
        })),
      }
    }),
  )
})
