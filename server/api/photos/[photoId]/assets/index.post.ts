import path from 'node:path'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import {
  preprocessImageBuffer,
  processImageMetadataAndSharp,
} from '~~/server/services/image/processor'
import {
  isDisplayImageStorageKey,
  serializePhotoAsset,
} from '~~/server/utils/raw-photo'

const bodySchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().trim().min(1).max(512).optional(),
  mimeType: z.string().trim().min(1).max(128).optional(),
})

const inferMimeType = (storageKey: string) => {
  const ext = path.extname(storageKey).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.heic':
      return 'image/heic'
    case '.heif':
      return 'image/heif'
    case '.gif':
      return 'image/gif'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    default:
      return 'application/octet-stream'
  }
}

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const photoId = getRouterParam(event, 'photoId')
  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
    })
  }

  const payload = bodySchema.parse(await readBody(event))
  if (!isDisplayImageStorageKey(payload.storageKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset must be a display image',
    })
  }

  const db = useDB()
  const photo = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  if (photo.sourceType !== 'raw') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only RAW photos can have version assets',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot update another user photo assets',
    })
  }

  const ownerUserId = Number(photo.ownerUserId)
  if (
    !Number.isSafeInteger(ownerUserId) ||
    !isStorageKeyInUserNamespace(payload.storageKey, ownerUserId)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot attach another user storage object',
    })
  }

  const { storageProvider } = useStorageProvider(event)
  const buffer = await storageProvider.get(payload.storageKey)
  if (!buffer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Asset file not found',
    })
  }

  const displayBuffer = await preprocessImageBuffer(buffer, payload.storageKey)
  const processed = await processImageMetadataAndSharp(
    displayBuffer,
    payload.storageKey,
  )
  if (!processed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Asset image metadata could not be read',
    })
  }

  const asset = await db
    .insert(tables.photoAssets)
    .values({
      photoId,
      kind: 'uploaded-render',
      storageKey: payload.storageKey,
      fileName: payload.fileName || path.basename(payload.storageKey),
      mimeType: payload.mimeType || inferMimeType(payload.storageKey),
      fileSize: buffer.length,
      width: processed.metadata.width,
      height: processed.metadata.height,
      isPrimary: false,
    })
    .returning()
    .get()

  return {
    success: true,
    asset: serializePhotoAsset(asset, { includeStorageKey: true }),
  }
})
