import type { StorageProvider } from '~~/server/services/storage'
import { isStorageKeyInUserNamespace } from './security.ts'

const HEIC_EXTENSIONS = ['.heic', '.heif', '.hif']

export const getPhotoStorageKeys = (photo: any) => {
  const keys = new Set<string>()
  if (photo.storageKey) {
    keys.add(photo.storageKey)
    const lowerStorageKey = photo.storageKey.toLowerCase()
    const heicExtension = HEIC_EXTENSIONS.find((ext) =>
      lowerStorageKey.endsWith(ext),
    )
    if (heicExtension) {
      keys.add(
        photo.storageKey.slice(
          0,
          photo.storageKey.length - heicExtension.length,
        ) + '.jpeg',
      )
    }
  }
  if (photo.displayStorageKey) keys.add(photo.displayStorageKey)
  if (photo.thumbnailKey) keys.add(photo.thumbnailKey)
  if (photo.livePhotoVideoKey) keys.add(photo.livePhotoVideoKey)
  for (const variant of Object.values(photo.imageVariants || {})) {
    const key = (variant as any)?.key
    if (typeof key === 'string' && key) keys.add(key)
  }
  for (const asset of photo.photoAssets || photo.assets || []) {
    const key = asset?.storageKey
    if (typeof key === 'string' && key) keys.add(key)
  }
  return [...keys]
}

export const getUserOwnedPhotoStorageKeys = (photo: any, userId: number) =>
  getPhotoStorageKeys(photo).filter((key) =>
    isStorageKeyInUserNamespace(key, userId),
  )

export const deletePhotoFiles = async (
  storageProvider: StorageProvider,
  photo: any,
  options: { strict?: boolean } = {},
) => {
  for (const key of getPhotoStorageKeys(photo)) {
    try {
      await storageProvider.delete(key)
    } catch (error) {
      if (options.strict) throw error
    }
  }
}
