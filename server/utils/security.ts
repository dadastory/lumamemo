import { normalizeStorageKey } from './storage-key.ts'
import { getPhotoDisplayStorageKey } from './raw-photo.ts'

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

  const role = user.role || (user.isAdmin ? 'admin' : 'user')

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    publicId: user.publicId ?? null,
    displayName: user.displayName ?? user.username,
    profileTitle: user.profileTitle ?? null,
    profileSlogan: user.profileSlogan ?? null,
    profileBio: user.profileBio ?? null,
    homepageVisibility: user.homepageVisibility ?? 'private',
    avatar: user.avatar ?? null,
    role,
    isAdmin: role === 'admin',
    disabledAt: user.disabledAt ?? null,
    createdAt: user.createdAt,
  }
}

const encodeStorageKeyPath = (key: string | null | undefined) =>
  key ? `/image/${key.split('/').map(encodeURIComponent).join('/')}` : null

const normalizePhotoImageVariants = (
  variants: AnyRecord | null | undefined,
  options: { includeKeys: boolean },
) => {
  if (!variants || typeof variants !== 'object') return null

  const normalized: AnyRecord = {}
  for (const name of ['thumb', 'card', 'view']) {
    const variant = variants[name]
    if (!variant || typeof variant !== 'object') continue

    const key = typeof variant.key === 'string' ? variant.key : null
    const url = encodeStorageKeyPath(key) ?? variant.url
    if (!url) continue

    normalized[name] = {
      ...(options.includeKeys && key ? { key } : {}),
      url,
      width: variant.width,
      height: variant.height,
      size: variant.size,
      format: variant.format || 'webp',
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

const serializeOwner = (record: AnyRecord) => {
  const id = record.ownerId ?? record.ownerUserId
  const username = record.ownerUsername ?? record.owner?.username
  if (id == null || !username) return null

  return {
    id,
    username,
    avatar: record.ownerAvatar ?? record.owner?.avatar ?? null,
  }
}

export const serializePublicPhoto = (photo: AnyRecord) => ({
  id: photo.id,
  sourceType: photo.sourceType ?? 'image',
  title: photo.title,
  description: photo.description,
  width: photo.displayWidth ?? photo.width,
  height: photo.displayHeight ?? photo.height,
  aspectRatio:
    photo.displayWidth && photo.displayHeight
      ? photo.displayWidth / photo.displayHeight
      : photo.aspectRatio,
  dateTaken: photo.dateTaken,
  fileSize: photo.displayFileSize ?? photo.fileSize,
  lastModified: photo.lastModified,
  originalUrl:
    encodeStorageKeyPath(getPhotoDisplayStorageKey(photo)) ?? photo.originalUrl,
  thumbnailUrl: encodeStorageKeyPath(photo.thumbnailKey) ?? photo.thumbnailUrl,
  thumbnailHash: photo.thumbnailHash,
  imageVariants: normalizePhotoImageVariants(photo.imageVariants, {
    includeKeys: false,
  }),
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
  owner: serializeOwner(photo),
})

export const serializeAdminPhoto = (photo: AnyRecord) => ({
  ...photo,
  sourceType: photo.sourceType ?? 'image',
  originalUrl:
    encodeStorageKeyPath(getPhotoDisplayStorageKey(photo)) ?? photo.originalUrl,
  thumbnailUrl: encodeStorageKeyPath(photo.thumbnailKey) ?? photo.thumbnailUrl,
  imageVariants: normalizePhotoImageVariants(photo.imageVariants, {
    includeKeys: true,
  }),
  livePhotoVideoUrl:
    encodeStorageKeyPath(photo.livePhotoVideoKey) ?? photo.livePhotoVideoUrl,
  owner: serializeOwner(photo),
})

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
  user?.role ? user.role === 'admin' : Boolean(user?.isAdmin)

export const isDisabledUser = (user: AnyRecord | null | undefined) =>
  Boolean(user?.disabledAt)

export const canManageOwnedResource = (
  user: AnyRecord | null | undefined,
  ownerUserId: number | null | undefined,
) => {
  if (!user || isDisabledUser(user)) return false
  if (isAdminUser(user)) return true
  return ownerUserId != null && Number(user.id) === Number(ownerUserId)
}

export const isSameUserId = (
  left: number | string | null | undefined,
  right: number | string | null | undefined,
) => {
  if (left == null || right == null) return false
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber === rightNumber
  }
  return String(left) === String(right)
}

export const getUserDeletionRestrictions = (
  currentUser: AnyRecord | null | undefined,
  targetUser: AnyRecord | null | undefined,
  activeAdminCount: number,
) => ({
  isSelf: isSameUserId(currentUser?.id, targetUser?.id),
  isLastActiveAdmin: isAdminUser(targetUser) && activeAdminCount <= 1,
})

export const isPhotoPublic = (photo: AnyRecord | null | undefined) =>
  photo?.visibility === 'public'

export const isStorageKeyInUserNamespace = (
  storageKey: string | null | undefined,
  userId: number | string,
) => {
  const normalized = normalizeStorageKey(storageKey)
  if (!normalized) return false

  if (
    storageKey?.startsWith('/') &&
    !normalized.startsWith('users/') &&
    !normalized.startsWith('photos/users/')
  ) {
    return false
  }

  const namespace = `users/${userId}/`
  return (
    normalized.startsWith(namespace) || normalized.includes(`/${namespace}`)
  )
}

export const getStorageKeyOwnerUserId = (
  storageKey: string | null | undefined,
) => {
  const normalized = normalizeStorageKey(storageKey)
  if (!normalized) return null
  const match = normalized.match(/(?:^|\/)users\/([1-9]\d*)(?:\/|$)/)
  if (!match) return null

  const userId = Number(match[1])
  return Number.isSafeInteger(userId) ? userId : null
}

const normalizeOwnerUserId = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const userId = Number(value)
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null
}

export const resolvePhotoTaskOwnerUserId = ({
  storageKey,
  existingOwnerUserId,
}: {
  storageKey: string | null | undefined
  existingOwnerUserId?: unknown
  explicitOwnerUserId?: unknown
}) => {
  const existingOwner = normalizeOwnerUserId(existingOwnerUserId)
  if (existingOwner !== null) return existingOwner
  return getStorageKeyOwnerUserId(storageKey)
}

const getCurrentSessionUser = async (user: AnyRecord | null | undefined) => {
  if (!user?.id) return null
  const { useDB, tables, eq } = await import('./db.ts')

  return await useDB()
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, user.id))
    .get()
}

const clearInvalidSession = async (event: any) => {
  await clearUserSession(event)
}

export async function requireActiveUserSession(event: any) {
  const session = await requireUserSession(event)
  const currentUser = await getCurrentSessionUser(session.user)

  if (!currentUser) {
    await clearInvalidSession(event)
    throw createError({
      statusCode: 401,
      statusMessage: 'Session user no longer exists',
    })
  }

  if (isDisabledUser(currentUser)) {
    await clearInvalidSession(event)
    throw createError({
      statusCode: 403,
      statusMessage: 'User is disabled',
    })
  }

  return {
    ...session,
    user: sanitizeSessionUser(currentUser),
  }
}

export async function requireAdminSession(event: any) {
  const session = await requireActiveUserSession(event)

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
  const currentUser = await getCurrentSessionUser(session.user)

  if (session.user && (!currentUser || isDisabledUser(currentUser))) {
    await clearInvalidSession(event)
  }

  return {
    ...session,
    user: sanitizeSessionUser(currentUser),
  }
}

export async function isFirstLaunch() {
  const { settingsManager } =
    await import('../services/settings/settingsManager')
  return Boolean(
    await settingsManager.get('system', 'firstLaunch' as any, true),
  )
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
  return (
    await db
      .select({
        photoId: tables.albumPhotos.photoId,
      })
      .from(tables.albumPhotos)
      .innerJoin(
        tables.albums,
        eq(tables.albumPhotos.albumId, tables.albums.id),
      )
      .where(eq(tables.albums.isHidden, true))
      .all()
  ).map((row: { photoId: string }) => row.photoId)
}

export async function getVisiblePhotos() {
  const { useDB, tables, eq, and } = await import('./db')
  const { desc, getTableColumns, notInArray } = await import('drizzle-orm')
  const db = useDB()
  const hiddenPhotoIds = await getHiddenPhotoIds()
  const selectColumns = {
    ...getTableColumns(tables.photos),
    ownerId: tables.users.id,
    ownerUsername: tables.users.username,
    ownerAvatar: tables.users.avatar,
  }

  if (hiddenPhotoIds.length > 0) {
    return await db
      .select(selectColumns)
      .from(tables.photos)
      .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))
      .where(
        and(
          eq(tables.photos.visibility, 'public'),
          notInArray(tables.photos.id, hiddenPhotoIds),
        ),
      )
      .orderBy(desc(tables.photos.dateTaken))
      .all()
  }

  return await db
    .select(selectColumns)
    .from(tables.photos)
    .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))
    .where(eq(tables.photos.visibility, 'public'))
    .orderBy(desc(tables.photos.dateTaken))
    .all()
}

export async function getPhotoByStorageKey(key: string) {
  const { useDB, tables, eq } = await import('./db')
  const db = useDB()
  const photos = await db.select().from(tables.photos).all()
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) return undefined

  const photo = photos.find((photo: AnyRecord) => {
    const variantKeys = Object.values(photo.imageVariants || {})
      .map((variant: any) => variant?.key)
      .map((variantKey: string | null | undefined) =>
        normalizeStorageKey(variantKey),
      )
      .filter(Boolean)

    return (
      photo.storageKey === normalizedKey ||
      photo.displayStorageKey === normalizedKey ||
      photo.thumbnailKey === normalizedKey ||
      photo.livePhotoVideoKey === normalizedKey ||
      variantKeys.includes(normalizedKey) ||
      storagePathMatches(photo.originalUrl, normalizedKey) ||
      storagePathMatches(photo.thumbnailUrl, normalizedKey) ||
      storagePathMatches(photo.livePhotoVideoUrl, normalizedKey)
    )
  })
  if (photo) return photo

  const asset = await db
    .select({
      photoId: tables.photoAssets.photoId,
    })
    .from(tables.photoAssets)
    .where(eq(tables.photoAssets.storageKey, normalizedKey))
    .get()

  if (!asset?.photoId) return undefined

  return await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, asset.photoId))
    .get()
}

export async function getVisiblePhotoByStorageKey(key: string) {
  const photo = await getPhotoByStorageKey(key)
  return photo && isPhotoPublic(photo) ? photo : null
}

export async function isPhotoVisibleToRequest(event: any, photoId: string) {
  const session = await getSafeUserSession(event)
  if (isDisabledUser(session.user)) return false
  if (isAdminUser(session.user)) return true

  const { useDB, tables, eq } = await import('./db')
  const db = useDB()
  const photo = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) return false
  if (canManageOwnedResource(session.user, photo.ownerUserId)) return true
  return isPhotoPublic(photo)
}

export function storagePathMatches(
  url: string | null | undefined,
  key: string,
) {
  if (!url) return false

  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) return false
  const decodedUrl = decodeURIComponent(url)
  return (
    decodedUrl === key ||
    decodedUrl === `/${normalizedKey}` ||
    decodedUrl.endsWith(`/${normalizedKey}`)
  )
}

export async function authorizePhotoStorageKey(event: any, key: string) {
  const session = await getSafeUserSession(event)
  if (isDisabledUser(session.user)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'User is disabled',
    })
  }
  if (isAdminUser(session.user)) return

  const photo = await getPhotoByStorageKey(key)
  const normalizedKey = normalizeStorageKey(key)
  const isOriginalKey = Boolean(
    photo &&
    normalizedKey &&
    (photo.storageKey === normalizedKey ||
      storagePathMatches(photo.originalUrl, normalizedKey)),
  )

  if (isOriginalKey && photo) {
    const isRawOriginalKey =
      photo.sourceType === 'raw' && photo.storageKey === normalizedKey
    if (isRawOriginalKey) {
      if (
        session.user &&
        canManageOwnedResource(session.user, photo.ownerUserId)
      ) {
        return
      }

      throw createError({
        statusCode: 404,
        statusMessage: 'Photo not found',
      })
    }

    if (
      session.user &&
      (canManageOwnedResource(session.user, photo.ownerUserId) ||
        isPhotoPublic(photo))
    ) {
      return
    }

    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  if (
    photo &&
    (isPhotoPublic(photo) ||
      canManageOwnedResource(session.user, photo.ownerUserId))
  ) {
    return
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Photo not found',
  })
}

export async function authorizeOriginalPhotoDownload(
  event: any,
  photo: AnyRecord,
) {
  const session = await getSafeUserSession(event)
  if (!session.user || isDisabledUser(session.user)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Login required',
    })
  }

  if (
    isAdminUser(session.user) ||
    canManageOwnedResource(session.user, photo.ownerUserId) ||
    isPhotoPublic(photo)
  ) {
    return
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Photo not found',
  })
}

export async function syncPhotoVisibility(photoIds: string[]) {
  const ids = [...new Set(photoIds.filter(Boolean))]
  if (ids.length === 0) return

  const { useDB, tables, eq, and } = await import('./db')
  const db = useDB()

  for (const photoId of ids) {
    const publicAlbum = await db
      .select({ id: tables.albums.id })
      .from(tables.albumPhotos)
      .innerJoin(
        tables.albums,
        eq(tables.albumPhotos.albumId, tables.albums.id),
      )
      .where(
        and(
          eq(tables.albumPhotos.photoId, photoId),
          eq(tables.albums.isHidden, false),
        ),
      )
      .limit(1)
      .get()

    await db
      .update(tables.photos)
      .set({ visibility: publicAlbum ? 'public' : 'private' })
      .where(eq(tables.photos.id, photoId))
      .run()
  }
}
