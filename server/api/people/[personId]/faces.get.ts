import { inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import {
  assertMachineLearningAvailable,
  isMachineLearningFeatureEnabled,
} from '~~/server/utils/ml-capabilities'
import { encodeStorageKeyPath, serializeAdminPhoto } from '~~/server/utils/security'

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
  const params = await getValidatedRouterParams(
    event,
    z.object({
      personId: z.coerce.number().int().positive(),
    }).parse,
  )

  const personRows = normalizeRows(
    await useDB().execute(sql`
      select id
      from people
      where id = ${params.personId} and owner_user_id = ${session.user.id}
      limit 1
    `),
  )
  if (personRows.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Person not found',
    })
  }

  const rows = await (await getVectorStore()).listFacePayloads({
    ownerUserId: session.user.id,
    personId: params.personId,
  })
  const photoIds = Array.from(
    new Set(rows.map((row) => row.photoId).filter(Boolean)),
  )
  const photos =
    photoIds.length > 0
      ? await useDB()
          .select()
          .from(tables.photos)
          .where(inArray(tables.photos.id, photoIds))
          .all()
      : []
  const photosById = new Map(photos.map((photo) => [photo.id, photo]))

  return rows.map((row) => ({
    id: row.faceId,
    photoId: row.photoId,
    personId: row.personId,
    boundingBox: row.boundingBox,
    score: row.score,
    cropStorageKey: row.cropStorageKey,
    cropUrl: encodeStorageKeyPath(row.cropStorageKey),
    cropWidth: row.cropWidth,
    cropHeight: row.cropHeight,
    cropSize: row.cropSize,
    createdAt: row.updatedAt,
    photo: photosById.has(row.photoId)
      ? serializeAdminPhoto(photosById.get(row.photoId))
      : null,
  }))
})
