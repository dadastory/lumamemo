import { and, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { z } from 'zod'

import { getPhotoDisplayStorageKey } from '~~/server/utils/raw-photo'
import { serializeAdminPhoto } from '~~/server/utils/security'
import { assertUserStorageQuota } from '~~/server/services/storage/quota'

const bodySchema = z.object({
  degrees: z.union([z.literal(-90), z.literal(90)]),
})

const getContentType = (storageKey: string) => {
  const extension = storageKey.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'heic':
      return 'image/heic'
    case 'heif':
      return 'image/heif'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    default:
      return 'image/jpeg'
  }
}

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const photoId = getRouterParam(event, 'photoId')
  const payload = bodySchema.parse(await readBody(event))

  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
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
      statusMessage: 'Only RAW display images can be rotated here',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot update another user photo',
    })
  }

  const displayStorageKey = getPhotoDisplayStorageKey(photo)
  if (!displayStorageKey || displayStorageKey === photo.storageKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'RAW photo has no editable display image',
    })
  }

  const { storageProvider } = useStorageProvider(event)
  const buffer = await storageProvider.get(displayStorageKey)
  if (!buffer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Display image file not found',
    })
  }

  const rotatedBuffer = await sharp(buffer, { limitInputPixels: false })
    .rotate(payload.degrees)
    .toBuffer()
  const metadata = await sharp(rotatedBuffer, {
    limitInputPixels: false,
  }).metadata()

  if (!metadata.width || !metadata.height) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Rotated display image metadata could not be read',
    })
  }

  const owner = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, photo.ownerUserId))
    .get()

  if (owner) {
    await assertUserStorageQuota(owner, {
      additionalBytes: rotatedBuffer.length,
      replacingBytes: buffer.length,
      storageProvider,
      resolveMissingSizes: true,
    })
  }

  await storageProvider.create(
    displayStorageKey,
    rotatedBuffer,
    getContentType(displayStorageKey),
  )

  await db
    .update(tables.photos)
    .set({
      displayFileSize: rotatedBuffer.length,
      displayWidth: metadata.width,
      displayHeight: metadata.height,
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.width / metadata.height,
      thumbnailKey: null,
      thumbnailUrl: null,
      thumbnailHash: null,
      imageVariants: null,
      lastModified: new Date().toISOString(),
    })
    .where(eq(tables.photos.id, photoId))
    .run()

  await db
    .update(tables.photoAssets)
    .set({
      fileSize: rotatedBuffer.length,
      width: metadata.width,
      height: metadata.height,
    })
    .where(
      and(
        eq(tables.photoAssets.photoId, photoId),
        eq(tables.photoAssets.storageKey, displayStorageKey),
      ),
    )
    .run()

  const workerPool = globalThis.__workerPool
  let taskId: number | null = null
  if (workerPool) {
    taskId = await workerPool.addTask(
      {
        type: 'photo-variants',
        photoId,
        ownerUserId: photo.ownerUserId,
        reindexMlAfterVariants: true,
      },
      { priority: 2, maxAttempts: 3 },
    )
  } else {
    logger.image.warn(
      `Worker pool not initialized, skipping variant rebuild for ${photoId}`,
    )
  }

  const updatedPhoto = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  return {
    success: true,
    taskId,
    photo: serializeAdminPhoto(updatedPhoto),
  }
})
