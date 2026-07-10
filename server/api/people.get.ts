import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import {
  assertMachineLearningAvailable,
  isMachineLearningFeatureEnabled,
} from '~~/server/utils/ml-capabilities'
import { encodeStorageKeyPath } from '~~/server/utils/security'

const normalizeRows = (result: any): any[] => {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.rows)) return result.rows
  if (Array.isArray(result?.[0])) return result[0]
  return []
}

export default defineEventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  if (!(await isMachineLearningFeatureEnabled('ml.faceAlbum.enabled'))) {
    return []
  }
  await assertMachineLearningAvailable()
  const query = await getValidatedQuery(
    event,
    z.object({
      includeHidden: z.coerce.boolean().optional().default(false),
    }).parse,
  )

  const result = await useDB().execute(sql`
    select
      people.id,
      people.owner_user_id as "ownerUserId",
      people.name,
      people.cover_photo_id as "coverPhotoId",
      people.is_hidden as "isHidden",
      people.is_favorite as "isFavorite",
      people.birth_date as "birthDate",
      people.created_at as "createdAt",
      people.updated_at as "updatedAt"
    from people
    where
      people.owner_user_id = ${session.user.id}
      and (${query.includeHidden} or people.is_hidden = false)
    order by people.updated_at desc
  `)
  const people = normalizeRows(result)
  const faces = await (await getVectorStore()).listFacePayloads({
    ownerUserId: session.user.id,
    includeUnassigned: true,
  })
  const facesByPersonId = new Map<number, typeof faces>()
  for (const face of faces) {
    if (!face.personId) continue
    const list = facesByPersonId.get(face.personId) || []
    list.push(face)
    facesByPersonId.set(face.personId, list)
  }

  return people
    .map((person) => {
      const personFaces = facesByPersonId.get(Number(person.id)) || []
      return {
        ...person,
        faceCount: personFaces.length,
        photoCount: new Set(personFaces.map((face) => face.photoId)).size,
        faceCropUrl: encodeStorageKeyPath(personFaces[0]?.cropStorageKey),
      }
    })
    .sort((left, right) => Number(right.faceCount) - Number(left.faceCount))
})
