import { and, desc, eq, getTableColumns, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import { isMachineLearningFeatureEnabled } from '~~/server/utils/ml-capabilities'
import { canViewOwnerPrivateContent } from '~~/server/utils/public-profile'
import {
  encodeStorageKeyPath,
  serializeAdminPhoto,
  serializePublicPhoto,
} from '~~/server/utils/security'

export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'publicId')
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public profile ID is required',
    })
  }
  const { personId } = await getValidatedRouterParams(
    event,
    z.object({ personId: z.coerce.number().int().positive() }).parse,
  )

  const db = useDB()
  const session = await getSafeUserSession(event)
  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.publicId, publicId))
    .get()

  const isOwner = canViewOwnerPrivateContent(session.user, user?.id)
  if (
    !user ||
    isDisabledUser(user) ||
    (user.homepageVisibility !== 'public' && !isOwner)
  ) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }
  if (!(await isMachineLearningFeatureEnabled('ml.faceAlbum.enabled'))) {
    return []
  }

  const person = await db
    .select()
    .from((tables as any).people)
    .where(eq((tables as any).people.id, personId))
    .get()
  if (!person || Number(person.ownerUserId) !== Number(user.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  if (!isOwner && person.isHidden) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }

  const allowedPhotos = await db
    .select({ id: tables.photos.id, visibility: tables.photos.visibility })
    .from(tables.photos)
    .where(
      isOwner
        ? eq(tables.photos.ownerUserId, user.id)
        : and(
            eq(tables.photos.ownerUserId, user.id),
            eq(tables.photos.visibility, 'public'),
          ),
    )
    .all()
  const allowedPhotoIds = new Set(allowedPhotos.map((photo) => photo.id))
  if (allowedPhotoIds.size === 0) return []

  const personFaces = await (await getVectorStore())
    .listFacePayloads({
      ownerUserId: user.id,
      personId,
      photoIds: Array.from(allowedPhotoIds),
    })
    .catch(() => [])
  const photoIds = Array.from(
    new Set(personFaces.map((face) => face.photoId).filter(Boolean)),
  )
  if (photoIds.length === 0) return []

  const photos = await db
    .select({ ...getTableColumns(tables.photos) })
    .from(tables.photos)
    .where(inArray(tables.photos.id, photoIds))
    .orderBy(desc(tables.photos.dateTaken))
    .all()

  const facesByPhotoId = new Map<string, any[]>()
  for (const face of personFaces) {
    if (!allowedPhotoIds.has(face.photoId)) continue
    const list = facesByPhotoId.get(face.photoId) || []
    list.push({
      ...face,
      id: face.faceId,
      cropUrl: encodeStorageKeyPath(face.cropStorageKey),
      personName: person.name ?? null,
      personIsHidden: person.isHidden ?? null,
    })
    facesByPhotoId.set(face.photoId, list)
  }

  return photos
    .filter((photo) => allowedPhotoIds.has(photo.id))
    .map((photo) => ({
      ...(isOwner ? serializeAdminPhoto(photo) : serializePublicPhoto(photo)),
      photoFaces: facesByPhotoId.get(photo.id) || [],
    }))
})
