import sharp from 'sharp'

export default eventHandler(async (event) => {
  const { storageProvider } = useStorageProvider(event)

  let url = getRouterParam(event, 'thumbnailUrl')

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid thumbnailUrl',
    })
  }

  url = decodeURIComponent(url)

  let storageKey: string | null = null

  if (url.startsWith('/storage/')) {
    storageKey = url.slice('/storage/'.length)
  } else if (url.startsWith('/image/')) {
    storageKey = url.slice('/image/'.length)
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid thumbnailUrl',
    })
  }

  await authorizePhotoStorageKey(event, storageKey)

  const photo = await storageProvider.get(storageKey)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  const sharpInst = sharp(photo).rotate()
  return await sharpInst.jpeg({ quality: 85 }).toBuffer()
})
