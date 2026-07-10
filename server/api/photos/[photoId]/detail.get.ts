import { and, eq, inArray } from 'drizzle-orm'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import {
  encodeStorageKeyPath,
  serializeAdminPhoto,
} from '~~/server/utils/security'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
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

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot read another user photo',
    })
  }

  const photoFaces = await (
    await getVectorStore()
  )
    .listFacePayloads({
      ownerUserId: photo.ownerUserId,
      photoIds: [photoId],
      includeUnassigned: true,
    })
    .catch(() => [])
  const personIds = Array.from(
    new Set(photoFaces.map((face) => face.personId).filter(Boolean)),
  ) as number[]
  const peopleRows =
    personIds.length > 0
      ? await useDB()
          .select({
            id: (tables as any).people.id,
            name: (tables as any).people.name,
            isHidden: (tables as any).people.isHidden,
          })
          .from((tables as any).people)
          .where(
            and(
              inArray((tables as any).people.id, personIds),
              eq((tables as any).people.ownerUserId, photo.ownerUserId),
            ),
          )
          .all()
      : []
  const peopleById = new Map(
    peopleRows.map((person) => [Number(person.id), person]),
  )
  const serializedFaces = photoFaces.map((face: any) => {
    const person = face.personId ? peopleById.get(face.personId) : null
    return {
      ...face,
      id: face.faceId,
      cropUrl: encodeStorageKeyPath(face.cropStorageKey),
      personName: person?.name ?? null,
      personIsHidden: person?.isHidden ?? null,
    }
  })

  return {
    photo: {
      ...serializeAdminPhoto(photo),
      photoFaces: serializedFaces,
    },
    photoFaces: serializedFaces,
  }
})
