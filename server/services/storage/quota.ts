import { eq, inArray } from 'drizzle-orm'
import { getDatabaseProvider } from '~~/server/utils/db'
import { getUserOwnedPhotoStorageKeys } from '~~/server/utils/photo-delete'
import { isStorageKeyInUserNamespace } from '~~/server/utils/security'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import { logger } from '~~/server/utils/logger'
import type { StorageProvider } from './interfaces'

export const BYTES_PER_GB = 1024 * 1024 * 1024
export const DEFAULT_USER_STORAGE_QUOTA_GB = 50
export const MIN_USER_STORAGE_QUOTA_GB = 0.1
export const MAX_USER_STORAGE_QUOTA_GB = 102400

type UserQuotaSubject = {
  id: number
  storageQuotaBytes?: number | null
}

type StorageUsageOptions = {
  storageProvider?: StorageProvider
  resolveMissingSizes?: boolean
}

type QuotaCheckOptions = StorageUsageOptions & {
  additionalBytes?: number
  replacingBytes?: number
}

export type StorageEntry = {
  key: string
  size: number | null
}

const quotaLogger = logger.dynamic('storage-quota')

const toFiniteNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const quotaGbToBytes = (value: unknown) => {
  const number = toFiniteNumber(value)
  if (number === null || number <= 0) return null
  return Math.round(number * BYTES_PER_GB)
}

export const validateStorageQuotaGB = (
  value: unknown,
  options: { nullable?: boolean } = {},
) => {
  if (value === null && options.nullable) return null

  const number = toFiniteNumber(value)
  if (
    number === null ||
    number < MIN_USER_STORAGE_QUOTA_GB ||
    number > MAX_USER_STORAGE_QUOTA_GB
  ) {
    throw new Error(
      `Storage quota must be between ${MIN_USER_STORAGE_QUOTA_GB} and ${MAX_USER_STORAGE_QUOTA_GB} GB`,
    )
  }

  return number
}

export const quotaBytesToGb = (value: unknown) => {
  const number = toFiniteNumber(value)
  if (number === null || number <= 0) return null
  return Number((number / BYTES_PER_GB).toFixed(2))
}

export const getDefaultUserStorageQuotaBytes = async () => {
  const quotaGB =
    (await settingsManager.get<number>(
      'system',
      'storage.defaultUserQuotaGB',
    )) ?? DEFAULT_USER_STORAGE_QUOTA_GB
  return quotaGbToBytes(quotaGB) ?? DEFAULT_USER_STORAGE_QUOTA_GB * BYTES_PER_GB
}

export const resolveUserStorageQuota = async (user: UserQuotaSubject) => {
  const userQuota = toFiniteNumber(user.storageQuotaBytes)
  if (userQuota !== null && userQuota > 0) {
    return {
      quotaBytes: Math.round(userQuota),
      quotaSource: 'user' as const,
    }
  }

  return {
    quotaBytes: await getDefaultUserStorageQuotaBytes(),
    quotaSource: 'default' as const,
  }
}

const addEntry = (
  entries: Map<string, StorageEntry>,
  key: unknown,
  size: unknown,
) => {
  if (typeof key !== 'string' || !key) return
  const number = toFiniteNumber(size)
  const existing = entries.get(key)
  const normalizedSize = number !== null && number > 0 ? Math.round(number) : null
  if (!existing) {
    entries.set(key, { key, size: normalizedSize })
    return
  }
  if ((existing.size ?? 0) < (normalizedSize ?? 0)) {
    existing.size = normalizedSize
  }
}

const addPhotoEntries = (entries: Map<string, StorageEntry>, photo: any) => {
  addEntry(entries, photo.storageKey, photo.fileSize)
  addEntry(entries, photo.displayStorageKey, photo.displayFileSize)
  addEntry(entries, photo.livePhotoVideoKey, null)

  for (const variant of Object.values(photo.imageVariants || {})) {
    addEntry(entries, (variant as any)?.key, (variant as any)?.size)
  }

  for (const asset of photo.photoAssets || photo.assets || []) {
    addEntry(entries, asset?.storageKey, asset?.fileSize)
  }

  for (const face of photo.photoFaces || []) {
    addEntry(
      entries,
      face?.cropStorageKey || face?.crop_storage_key,
      face?.cropSize || face?.crop_size,
    )
  }
}

const attachPhotoAssets = async (photos: any[]) => {
  if (photos.length === 0) return photos
  const photoIds = photos.map((photo) => photo.id)
  const assets = await useDB()
    .select()
    .from(tables.photoAssets)
    .where(inArray(tables.photoAssets.photoId, photoIds))
    .all()
  const assetsByPhotoId = new Map<string, any[]>()
  for (const asset of assets) {
    const list = assetsByPhotoId.get(asset.photoId) || []
    list.push(asset)
    assetsByPhotoId.set(asset.photoId, list)
  }
  return photos.map((photo) => ({
    ...photo,
    photoAssets: assetsByPhotoId.get(photo.id) || [],
  }))
}

const attachFacePayloads = async (photos: any[], ownerUserId: number) => {
  if (photos.length === 0 || getDatabaseProvider() !== 'postgres') return photos
  const faces = await getVectorStore()
    .then((vectorStore) =>
      vectorStore.listFacePayloads({
        ownerUserId,
        includeUnassigned: true,
      }),
    )
    .catch((error) => {
      quotaLogger.warn(
        `Failed to collect face crop sizes for user ${ownerUserId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return []
    })

  const facesByPhotoId = new Map<string, any[]>()
  for (const face of faces) {
    const list = facesByPhotoId.get(face.photoId) || []
    list.push(face)
    facesByPhotoId.set(face.photoId, list)
  }
  return photos.map((photo) => ({
    ...photo,
    photoFaces: facesByPhotoId.get(photo.id) || [],
  }))
}

const resolveMissingEntrySizes = async (
  entries: StorageEntry[],
  storageProvider?: StorageProvider,
) => {
  if (!storageProvider) return entries
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.size !== null) return
      try {
        const meta = await storageProvider.getFileMeta(entry.key)
        entry.size = meta?.size ?? 0
      } catch (error) {
        quotaLogger.warn(
          `Failed to resolve storage size for ${entry.key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        entry.size = 0
      }
    }),
  )
  return entries
}

export const collectUserStorageEntries = async (
  userId: number,
  options: StorageUsageOptions = {},
) => {
  const photos = await useDB()
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.ownerUserId, userId))
    .all()

  const photosWithAssets = await attachPhotoAssets(photos)
  const photosWithFaces = await attachFacePayloads(photosWithAssets, userId)
  const entries = new Map<string, StorageEntry>()

  for (const photo of photosWithFaces) {
    for (const key of getUserOwnedPhotoStorageKeys(photo, userId)) {
      addEntry(entries, key, null)
    }
    addPhotoEntries(entries, photo)
  }

  const ownedEntries = [...entries.values()].filter((entry) =>
    isStorageKeyInUserNamespace(entry.key, userId),
  )

  if (options.resolveMissingSizes) {
    await resolveMissingEntrySizes(ownedEntries, options.storageProvider)
  }

  return ownedEntries
}

export const getUserStorageUsage = async (
  userId: number,
  options: StorageUsageOptions = {},
) => {
  const ownedEntries = await collectUserStorageEntries(userId, options)
  const usedBytes = ownedEntries.reduce(
    (total, entry) => total + Math.max(0, entry.size ?? 0),
    0,
  )

  return {
    usedBytes,
    fileCount: ownedEntries.length,
  }
}

export const getUserStorageSummary = async (
  user: UserQuotaSubject,
  options: StorageUsageOptions = {},
) => {
  const usage = await getUserStorageUsage(user.id, options)
  const quota = await resolveUserStorageQuota(user)
  const usageRatio =
    quota.quotaBytes > 0 ? usage.usedBytes / quota.quotaBytes : 0

  return {
    storageUsageBytes: usage.usedBytes,
    storageFileCount: usage.fileCount,
    storageQuotaBytes: quota.quotaBytes,
    storageQuotaGB: quotaBytesToGb(quota.quotaBytes),
    storageQuotaSource: quota.quotaSource,
    storageUsageRatio: usageRatio,
    storageOverQuota: usage.usedBytes > quota.quotaBytes,
  }
}

export const assertUserStorageQuota = async (
  user: UserQuotaSubject,
  options: QuotaCheckOptions = {},
) => {
  const summary = await getUserStorageSummary(user, options)
  const additionalBytes = Math.max(0, options.additionalBytes || 0)
  const replacingBytes = Math.max(0, options.replacingBytes || 0)
  const projectedUsage =
    summary.storageUsageBytes + additionalBytes - replacingBytes

  if (projectedUsage <= summary.storageQuotaBytes) {
    return {
      ...summary,
      projectedUsageBytes: projectedUsage,
      remainingBytes: Math.max(0, summary.storageQuotaBytes - projectedUsage),
    }
  }

  throw createError({
    statusCode: 413,
    statusMessage: 'Storage quota exceeded',
    data: {
      title: 'Storage quota exceeded',
      message: 'Storage quota exceeded',
      usedBytes: summary.storageUsageBytes,
      quotaBytes: summary.storageQuotaBytes,
      attemptedBytes: additionalBytes,
      projectedUsageBytes: projectedUsage,
      remainingBytes: Math.max(
        0,
        summary.storageQuotaBytes - summary.storageUsageBytes,
      ),
    },
  })
}
