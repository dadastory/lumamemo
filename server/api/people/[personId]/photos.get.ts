import { eq, getTableColumns, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import {
  canManageOwnedResource,
  encodeStorageKeyPath,
  serializeAdminPhoto,
} from '~~/server/utils/security'
import {
  assertMachineLearningAvailable,
  isMachineLearningFeatureEnabled,
} from '~~/server/utils/ml-capabilities'

export default defineEventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  if (!(await isMachineLearningFeatureEnabled('ml.faceAlbum.enabled'))) {
    return []
  }
  await assertMachineLearningAvailable()
  const { personId } = await getValidatedRouterParams(
    event,
    z.object({ personId: z.coerce.number().int().positive() }).parse,
  )

  const postgresTables = tables as any
  const person = await useDB()
    .select()
    .from(postgresTables.people)
    .where(eq(postgresTables.people.id, personId))
    .get()
  if (!person) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  if (!canManageOwnedResource(session.user, person.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot read another user person',
    })
  }

  const faceRows = await (await getVectorStore()).listFacePayloads({
    ownerUserId: person.ownerUserId,
    personId,
  })
  const photoFacesByPhotoId = new Map<string, any[]>()
  for (const face of faceRows) {
    const list = photoFacesByPhotoId.get(face.photoId) || []
    list.push({
      ...face,
      id: face.faceId,
      cropUrl: encodeStorageKeyPath(face.cropStorageKey),
      personName: person.name ?? null,
      personIsHidden: person.isHidden ?? null,
    })
    photoFacesByPhotoId.set(face.photoId, list)
  }

  const photoIds = Array.from(new Set(faceRows.map((row: any) => row.photoId)))
  if (photoIds.length === 0) return []

  const photos = await useDB()
    .select({ ...getTableColumns(tables.photos) })
    .from(tables.photos)
    .where(inArray(tables.photos.id, photoIds))
    .all()

  return photos
    .filter((photo) => canManageOwnedResource(session.user, photo.ownerUserId))
    .sort((left, right) =>
      String(right.dateTaken || '').localeCompare(String(left.dateTaken || '')),
    )
    .map((photo) => ({
      ...serializeAdminPhoto(photo),
      photoFaces: photoFacesByPhotoId.get(photo.id) || [],
    }))
})
