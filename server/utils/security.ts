type AnyRecord = Record<string, any>

const PUBLIC_EXIF_KEYS = [
  'Title',
  'XPTitle',
  'Subject',
  'Keywords',
  'XPKeywords',
  'Description',
  'ImageDescription',
  'CaptionAbstract',
  'Orientation',
  'Make',
  'Model',
  'Software',
  'Artist',
  'Copyright',
  'ExposureTime',
  'FNumber',
  'ExposureProgram',
  'ISO',
  'ShutterSpeedValue',
  'ApertureValue',
  'BrightnessValue',
  'ExposureCompensation',
  'MaxApertureValue',
  'OffsetTime',
  'OffsetTimeOriginal',
  'OffsetTimeDigitized',
  'LightSource',
  'Flash',
  'FocalLength',
  'FocalLengthIn35mmFormat',
  'LensMake',
  'LensModel',
  'ColorSpace',
  'ExposureMode',
  'SceneCaptureType',
  'Aperture',
  'ScaleFactor35efl',
  'ShutterSpeed',
  'LightValue',
  'DateTimeOriginal',
  'DateTimeDigitized',
  'ImageWidth',
  'ImageHeight',
  'MeteringMode',
  'WhiteBalance',
  'WBShiftAB',
  'WBShiftGM',
  'WhiteBalanceBias',
  'WhiteBalanceFineTune',
  'FlashMeteringMode',
  'SensingMethod',
  'FocalPlaneXResolution',
  'FocalPlaneYResolution',
  'GPSAltitude',
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitudeRef',
  'GPSLatitudeRef',
  'GPSLongitudeRef',
  'Rating',
] as const

const serializePublicExif = (exif: AnyRecord | null | undefined) => {
  if (!exif || typeof exif !== 'object') return exif ?? null

  const safeExif: AnyRecord = {}
  for (const key of PUBLIC_EXIF_KEYS) {
    if (exif[key] !== undefined) {
      safeExif[key] = exif[key]
    }
  }
  return safeExif
}

export const sanitizeSessionUser = (user: AnyRecord | null | undefined) => {
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar ?? null,
    isAdmin: Boolean(user.isAdmin),
    createdAt: user.createdAt,
  }
}

const encodeStorageKeyPath = (key: string | null | undefined) =>
  key ? `/image/${key.split('/').map(encodeURIComponent).join('/')}` : null

export const serializePublicPhoto = (photo: AnyRecord) => ({
  id: photo.id,
  title: photo.title,
  description: photo.description,
  width: photo.width,
  height: photo.height,
  aspectRatio: photo.aspectRatio,
  dateTaken: photo.dateTaken,
  fileSize: photo.fileSize,
  lastModified: photo.lastModified,
  originalUrl: encodeStorageKeyPath(photo.storageKey) ?? photo.originalUrl,
  thumbnailUrl: encodeStorageKeyPath(photo.thumbnailKey) ?? photo.thumbnailUrl,
  thumbnailHash: photo.thumbnailHash,
  tags: photo.tags,
  exif: serializePublicExif(photo.exif),
  latitude: photo.latitude,
  longitude: photo.longitude,
  country: photo.country,
  city: photo.city,
  locationName: photo.locationName,
  isLivePhoto: photo.isLivePhoto,
  livePhotoVideoUrl:
    encodeStorageKeyPath(photo.livePhotoVideoKey) ?? photo.livePhotoVideoUrl,
})

export const serializeAdminPhoto = (photo: AnyRecord) => ({ ...photo })

export const serializePublicAlbum = (album: AnyRecord) => ({
  id: album.id,
  title: album.title,
  description: album.description,
  coverPhotoId: album.coverPhotoId,
  isHidden: false,
  createdAt: album.createdAt,
  updatedAt: album.updatedAt,
  photoIds: album.photoIds,
})

export const isAdminUser = (user: AnyRecord | null | undefined) =>
  Boolean(user?.isAdmin)

export async function requireAdminSession(event: any) {
  const session = await requireUserSession(event)

  if (!isAdminUser(session.user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    })
  }

  return {
    ...session,
    user: sanitizeSessionUser(session.user),
  }
}

export async function getSafeUserSession(event: any) {
  const session = await getUserSession(event)
  return {
    ...session,
    user: sanitizeSessionUser(session.user),
  }
}

export async function isFirstLaunch() {
  const { settingsManager } = await import(
    '../services/settings/settingsManager'
  )
  return Boolean(await settingsManager.get('system', 'firstLaunch' as any, true))
}

export async function requireFirstLaunch(event: any) {
  if (await isFirstLaunch()) return

  const session = await getUserSession(event)
  if (isAdminUser(session.user)) return

  throw createError({
    statusCode: 403,
    statusMessage: 'Wizard is disabled after setup',
  })
}

export async function getHiddenPhotoIds() {
  const { useDB, tables, eq } = await import('./db')
  const db = useDB()
  return db
    .select({
      photoId: tables.albumPhotos.photoId,
    })
    .from(tables.albumPhotos)
    .innerJoin(tables.albums, eq(tables.albumPhotos.albumId, tables.albums.id))
    .where(eq(tables.albums.isHidden, true))
    .all()
    .map((row: { photoId: string }) => row.photoId)
}

export async function getVisiblePhotos() {
  const { useDB, tables } = await import('./db')
  const { desc, notInArray } = await import('drizzle-orm')
  const db = useDB()
  const hiddenPhotoIds = await getHiddenPhotoIds()

  if (hiddenPhotoIds.length > 0) {
    return db
      .select()
      .from(tables.photos)
      .where(notInArray(tables.photos.id, hiddenPhotoIds))
      .orderBy(desc(tables.photos.dateTaken))
      .all()
  }

  return db
    .select()
    .from(tables.photos)
    .orderBy(desc(tables.photos.dateTaken))
    .all()
}

export async function getVisiblePhotoByStorageKey(key: string) {
  const visiblePhotos = await getVisiblePhotos()
  return visiblePhotos.find(
    (photo: AnyRecord) =>
      photo.storageKey === key ||
      photo.thumbnailKey === key ||
      photo.livePhotoVideoKey === key ||
      storagePathMatches(photo.originalUrl, key) ||
      storagePathMatches(photo.thumbnailUrl, key) ||
      storagePathMatches(photo.livePhotoVideoUrl, key),
  )
}

export async function isPhotoVisibleToRequest(event: any, photoId: string) {
  const session = await getUserSession(event)
  if (isAdminUser(session.user)) return true

  const visiblePhotos = await getVisiblePhotos()
  return visiblePhotos.some((photo: AnyRecord) => photo.id === photoId)
}

export function storagePathMatches(url: string | null | undefined, key: string) {
  if (!url) return false

  const normalizedKey = key.replace(/^\/+/, '')
  const decodedUrl = decodeURIComponent(url)
  return (
    decodedUrl === key ||
    decodedUrl === `/${normalizedKey}` ||
    decodedUrl.endsWith(`/${normalizedKey}`)
  )
}

export async function authorizePhotoStorageKey(event: any, key: string) {
  const session = await getUserSession(event)
  if (isAdminUser(session.user)) return

  const photo = await getVisiblePhotoByStorageKey(key)
  if (photo) return

  throw createError({
    statusCode: 404,
    statusMessage: 'Photo not found',
  })
}
