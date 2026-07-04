import type { StorageProvider } from '~~/server/services/storage/interfaces'

type BrowserDirectUploadProvider = StorageProvider & {
  getSignedUrl: NonNullable<StorageProvider['getSignedUrl']>
}

export const buildInternalUploadTarget = (
  objectKey: string,
  expiresIn = 3600,
) => ({
  signedUrl: `/api/photos/upload?key=${encodeURIComponent(objectKey)}`,
  fileKey: objectKey,
  expiresIn,
})

export const shouldUseBrowserDirectUpload = (
  _storageProvider: StorageProvider,
): _storageProvider is BrowserDirectUploadProvider => false
