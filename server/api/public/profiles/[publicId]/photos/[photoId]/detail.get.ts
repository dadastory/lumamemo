import { and, eq, getTableColumns, inArray } from 'drizzle-orm'
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
  const photoId = getRouterParam(event, 'photoId')
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public profile ID is required',
    })
  }
  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
    })
  }

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

  const photo = await db
    .select({
      ...getTableColumns(tables.photos),
      ownerId: tables.users.id,
      ownerUsername: tables.users.username,
      ownerAvatar: tables.users.avatar,
    })
    .from(tables.photos)
    .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))
    .where(
      isOwner
        ? and(
            eq(tables.photos.id, photoId),
            eq(tables.photos.ownerUserId, user.id),
          )
        : and(
            eq(tables.photos.id, photoId),
            eq(tables.photos.ownerUserId, user.id),
            eq(tables.photos.visibility, 'public'),
          ),
    )
    .get()

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  const photoFaces = await loadPublicPhotoFaces({
    ownerUserId: user.id,
    photoId,
    isOwner,
  })
  const serializedPhoto = isOwner
    ? serializeAdminPhoto(photo)
    : {
        ...serializePublicPhoto(photo),
        aiAnalysis: photo.aiAnalysis ?? null,
      }

  return {
    photo: {
      ...serializedPhoto,
      photoFaces,
    },
    photoFaces,
  }
})

const loadPublicPhotoFaces = async ({
  ownerUserId,
  photoId,
  isOwner,
}: {
  ownerUserId: number
  photoId: string
  isOwner: boolean
}) => {
  if (!(await isMachineLearningFeatureEnabled('ml.faceAlbum.enabled'))) {
    return []
  }

  const faceRows = await (await getVectorStore())
    .listFacePayloads({
      ownerUserId,
      photoIds: [photoId],
      includeUnassigned: isOwner,
    })
    .catch(() => [])
  const personIds = Array.from(
    new Set(faceRows.map((face) => Number(face.personId)).filter(Boolean)),
  )
  const peopleRows =
    personIds.length > 0
      ? await useDB()
          .select()
          .from((tables as any).people)
          .where(inArray((tables as any).people.id, personIds))
          .all()
      : []
  const peopleById = new Map(
    peopleRows
      .filter(
        (person: any) =>
          Number(person.ownerUserId) === Number(ownerUserId) &&
          (isOwner || !person.isHidden),
      )
      .map((person: any) => [Number(person.id), person]),
  )

  return faceRows
    .map((face: any) => {
      const person = face.personId ? peopleById.get(Number(face.personId)) : null
      if (!isOwner && !person) return null
      return {
        ...face,
        id: face.faceId,
        cropUrl: encodeStorageKeyPath(face.cropStorageKey),
        personName: person?.name ?? null,
        personIsHidden: person?.isHidden ?? null,
      }
    })
    .filter(Boolean)
}
