import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { tables, useDB } from '~~/server/utils/db'
import { canManageOwnedResource } from '~~/server/utils/security'
import {
  assertMachineLearningAvailable,
  assertMachineLearningFeatureEnabled,
} from '~~/server/utils/ml-capabilities'
import { getVectorStore } from '~~/server/services/ml/vector-store'

export default defineEventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  await assertMachineLearningFeatureEnabled(
    'ml.faceAlbum.enabled',
    'Face album is disabled',
  )
  await assertMachineLearningAvailable()
  const { faceId } = await getValidatedRouterParams(
    event,
    z.object({ faceId: z.coerce.number().int().positive() }).parse,
  )
  const body = await readValidatedBody(
    event,
    z.object({ personId: z.coerce.number().int().positive().nullable() }).parse,
  )

  const postgresTables = tables as any
  const vectorStore = await getVectorStore()
  const face = await vectorStore.getFacePayload(faceId)
  if (!face) {
    throw createError({ statusCode: 404, statusMessage: 'Face not found' })
  }
  if (!canManageOwnedResource(session.user, face.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot update another user face',
    })
  }

  if (body.personId !== null) {
    const person = await useDB()
      .select()
      .from(postgresTables.people)
      .where(eq(postgresTables.people.id, body.personId))
      .get()
    if (!person) {
      throw createError({ statusCode: 404, statusMessage: 'Person not found' })
    }
    if (!canManageOwnedResource(session.user, person.ownerUserId)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot assign face to another user person',
      })
    }
  }

  await vectorStore.setFacePersonId(faceId, body.personId)

  return { success: true, faceId, personId: body.personId }
})
