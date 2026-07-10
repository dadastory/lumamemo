import { eq, inArray } from 'drizzle-orm'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import { isMachineLearningFeatureEnabled } from '~~/server/utils/ml-capabilities'
import { canViewOwnerPrivateContent } from '~~/server/utils/public-profile'
import { encodeStorageKeyPath } from '~~/server/utils/security'

export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'publicId')
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public profile ID is required',
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
  if (!(await isMachineLearningFeatureEnabled('ml.faceAlbum.enabled'))) {
    return []
  }

  const photos = await db
    .select({
      id: tables.photos.id,
      visibility: tables.photos.visibility,
    })
    .from(tables.photos)
    .where(eq(tables.photos.ownerUserId, user.id))
    .all()
  const visiblePhotoIds = new Set(
    photos
      .filter((photo) => isOwner || photo.visibility === 'public')
      .map((photo) => photo.id),
  )
  if (visiblePhotoIds.size === 0) return []

  const faceRows = await (await getVectorStore())
    .listFacePayloads({
      ownerUserId: user.id,
      photoIds: Array.from(visiblePhotoIds),
      includeUnassigned: true,
    })
    .catch(() => [])
  const assignedFaces = faceRows.filter((face) => face.personId)
  const personIds = Array.from(
    new Set(assignedFaces.map((face) => Number(face.personId)).filter(Boolean)),
  )
  if (personIds.length === 0) return []

  const peopleRows = await db
    .select()
    .from((tables as any).people)
    .where(inArray((tables as any).people.id, personIds))
    .all()
  const peopleById = new Map(
    peopleRows
      .filter((person) => isOwner || !person.isHidden)
      .map((person) => [Number(person.id), person]),
  )

  const statsByPersonId = new Map<
    number,
    { faceCount: number; photoIds: Set<string>; faceCropUrl: string | null }
  >()
  for (const face of assignedFaces) {
    const personId = Number(face.personId)
    if (!peopleById.has(personId)) continue
    const stats =
      statsByPersonId.get(personId) ||
      ({
        faceCount: 0,
        photoIds: new Set<string>(),
        faceCropUrl: null,
      } as { faceCount: number; photoIds: Set<string>; faceCropUrl: string | null })
    stats.faceCount += 1
    stats.photoIds.add(face.photoId)
    stats.faceCropUrl ||= encodeStorageKeyPath(face.cropStorageKey)
    statsByPersonId.set(personId, stats)
  }

  return Array.from(statsByPersonId.entries())
    .map(([personId, stats]) => {
      const person = peopleById.get(personId)
      return person
        ? {
            id: person.id,
            name: person.name,
            isFavorite: person.isFavorite,
            faceCount: stats.faceCount,
            photoCount: stats.photoIds.size,
            faceCropUrl: stats.faceCropUrl,
          }
        : null
    })
    .filter(Boolean)
    .sort((left: any, right: any) => Number(right.faceCount) - Number(left.faceCount))
})
