import path from 'node:path'
import { authorizeOriginalPhotoDownload } from '~~/server/utils/security'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.hif': 'image/heif',
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

  if (!photo?.storageKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  await authorizeOriginalPhotoDownload(event, photo)

  const { storageProvider } = useStorageProvider(event)
  const buffer = await storageProvider.get(photo.storageKey)
  if (!buffer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo file not found',
    })
  }

  const extension = path.extname(photo.storageKey).toLowerCase() || '.jpg'
  const filename = `${sanitizeDownloadName(photo.title || photo.id)}${extension}`

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
