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

  let fetchUrl = url
  let storageKey: string | null = null

  if (url.startsWith('/storage/')) {
    storageKey = url.slice('/storage/'.length)
  } else if (url.startsWith('/image/')) {
    storageKey = url.slice('/image/'.length)
  } else {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid thumbnailUrl',
      })
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid thumbnailUrl',
      })
    }

    await authorizePhotoStorageKey(event, url)
  }

  if (storageKey) {
    await authorizePhotoStorageKey(event, storageKey)

    const photo = await storageProvider.get(storageKey)
    if (!photo) {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }
    const sharpInst = sharp(photo).rotate()
    return await sharpInst.jpeg({ quality: 85 }).toBuffer()
  }

  const photo = await fetch(fetchUrl)
    .then((res) => {
      if (!res.ok) {
        throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
      }
      return res.arrayBuffer()
    })
    .then((buf) => Buffer.from(buf))

  const sharpInst = sharp(photo).rotate()
  return await sharpInst.jpeg({ quality: 85 }).toBuffer()
})
