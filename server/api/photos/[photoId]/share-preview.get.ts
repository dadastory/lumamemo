import sharp from 'sharp'
import { isPhotoVisibleToRequest } from '~~/server/utils/security'

const PREVIEW_WIDTH = 1200
const PREVIEW_HEIGHT = 630

const storageKeyFromUrl = (url: string | null | undefined) => {
  if (!url) return null

  const decodedUrl = decodeURIComponent(url)
  if (decodedUrl.startsWith('/storage/')) {
    return decodedUrl.slice('/storage/'.length)
  }
  if (decodedUrl.startsWith('/image/')) {
    return decodedUrl.slice('/image/'.length)
  }

  return null
}

const getPreviewSourceKey = (photo: any) => {
  const orderedSources: string[] = [
    photo.imageVariants?.card?.key,
    storageKeyFromUrl(photo.imageVariants?.card?.url),
    photo.imageVariants?.view?.key,
    storageKeyFromUrl(photo.imageVariants?.view?.url),
    photo.imageVariants?.thumb?.key,
    storageKeyFromUrl(photo.imageVariants?.thumb?.url),
    photo.thumbnailKey,
    photo.storageKey,
    storageKeyFromUrl(photo.thumbnailUrl),
    storageKeyFromUrl(photo.originalUrl),
  ].filter((source): source is string => Boolean(source))

  return orderedSources[0]
}

export default eventHandler(async (event) => {
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

  if (!photo || !(await isPhotoVisibleToRequest(event, photoId))) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  const sourceKey = getPreviewSourceKey(photo)
  if (!sourceKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo image not found',
    })
  }

  const { storageProvider } = useStorageProvider(event)
  const sourceBuffer = await storageProvider.get(sourceKey)
  if (!sourceBuffer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo image not found',
    })
  }

  const previewBuffer = await sharp(sourceBuffer, { limitInputPixels: false })
    .rotate()
    .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, {
      fit: 'cover',
      position: 'center',
      fastShrinkOnLoad: false,
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer()

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Content-Length', String(previewBuffer.length))
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(
    event,
    'Content-Disposition',
    'inline; filename="share-preview.png"',
  )

  return previewBuffer
})
