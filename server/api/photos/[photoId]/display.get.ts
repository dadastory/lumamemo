import path from 'node:path'
import { authorizeOriginalPhotoDownload } from '~~/server/utils/security'
import { getPhotoDisplayStorageKey } from '~~/server/utils/raw-photo'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
}

const sanitizeDownloadName = (name: string) =>
  name.replace(/[\\/:*?"<>|\r\n]+/g, '-').trim() || 'photo'

export default eventHandler(async (event) => {
  await requireActiveUserSession(event)

  const photoId = getRouterParam(event, 'photoId')
  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
    })
  }

  const photo = await useDB()
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  const displayStorageKey = getPhotoDisplayStorageKey(photo)
  if (!photo || !displayStorageKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  await authorizeOriginalPhotoDownload(event, photo)

  const { storageProvider } = useStorageProvider(event)
  const buffer = await storageProvider.get(displayStorageKey)
  if (!buffer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Display image file not found',
    })
  }

  const extension = path.extname(displayStorageKey).toLowerCase() || '.jpg'
  const filename = `${sanitizeDownloadName(photo.title || photo.id)}-display${extension}`

  setHeader(
    event,
    'Content-Type',
    CONTENT_TYPES[extension] || 'application/octet-stream',
  )
  setHeader(event, 'Content-Length', String(buffer.length))
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  )

  return buffer
})
