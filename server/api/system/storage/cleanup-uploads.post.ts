import { cleanupExpiredPendingUploads } from '~~/server/services/storage/pending-uploads'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const { storageProvider } = useStorageProvider(event)
  return await cleanupExpiredPendingUploads({ storageProvider })
})
