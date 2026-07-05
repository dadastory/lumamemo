import path from 'node:path'

import {
  getFileExtension,
  isRawFileName,
} from '../../shared/utils/raw-photo.ts'
import { normalizeStorageKey } from './storage-key.ts'

export const DISPLAY_IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
])

const stripUrlDecorations = (value: string) => value.split(/[?#]/)[0] || value

export const getStorageKeyExtension = (storageKey: string | null | undefined) =>
  getFileExtension(stripUrlDecorations(storageKey || ''))

export const isRawStorageKey = (storageKey: string | null | undefined) =>
  isRawFileName(storageKey)

export const isDisplayImageStorageKey = (
  storageKey: string | null | undefined,
) => DISPLAY_IMAGE_EXTENSIONS.has(getStorageKeyExtension(storageKey))

export const getPhotoDisplayStorageKey = (
  photo:
    | {
        storageKey?: string | null
        displayStorageKey?: string | null
      }
    | null
    | undefined,
) => photo?.displayStorageKey || photo?.storageKey || null

export const getRawPreviewStorageKey = (photoId: string, ownerUserId: number) =>
  `photos/users/${ownerUserId}/raw-previews/${photoId}/preview.jpg`

export const getRawRenderStorageKey = ({
  photoId,
  ownerUserId,
  fileName,
}: {
  photoId: string
  ownerUserId: number
  fileName: string
}) => {
  const safeName = path
    .basename(fileName)
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .trim()
  return `photos/users/${ownerUserId}/raw-renders/${photoId}/${safeName || 'render.jpg'}`
}

const encodeStorageKeyPath = (key: string | null | undefined) => {
  const normalized = normalizeStorageKey(key)
  return normalized
    ? `/image/${normalized.split('/').map(encodeURIComponent).join('/')}`
    : null
}

export const serializePhotoAsset = (
  asset: any,
  options: { includeStorageKey: boolean },
) => ({
  id: asset.id,
  photoId: asset.photoId,
  kind: asset.kind,
  ...(options.includeStorageKey ? { storageKey: asset.storageKey } : {}),
  fileName: asset.fileName,
  mimeType: asset.mimeType,
  fileSize: asset.fileSize,
  width: asset.width,
  height: asset.height,
  isPrimary: Boolean(asset.isPrimary),
  url: encodeStorageKeyPath(asset.storageKey),
  createdAt: asset.createdAt,
})
