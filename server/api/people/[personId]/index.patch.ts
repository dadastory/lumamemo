import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { tables, useDB } from '~~/server/utils/db'
import { assertMachineLearningFeatureEnabled } from '~~/server/utils/ml-capabilities'
import { canManageOwnedResource } from '~~/server/utils/security'

export default defineEventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  await assertMachineLearningFeatureEnabled(
    'ml.faceAlbum.enabled',
    'Face album is disabled',
  )
  const { personId } = await getValidatedRouterParams(
    event,
    z.object({ personId: z.coerce.number().int().positive() }).parse,
  )
  const body = await readValidatedBody(
    event,
    z
      .object({
        name: z.string().trim().max(120).nullable().optional(),
        isHidden: z.boolean().optional(),
        isFavorite: z.boolean().optional(),
        birthDate: z.string().trim().max(40).nullable().optional(),
        coverPhotoId: z.string().trim().min(1).nullable().optional(),
      })
      .parse,
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
      statusMessage: 'Cannot update another user person',
    })
  }

  const result = await useDB().execute(sql`
    update people
    set
      name = ${body.name === undefined ? person.name : body.name},
      is_hidden = ${body.isHidden === undefined ? person.isHidden : body.isHidden},
      is_favorite = ${body.isFavorite === undefined ? person.isFavorite : body.isFavorite},
      birth_date = ${body.birthDate === undefined ? person.birthDate : body.birthDate},
      cover_photo_id = ${body.coverPhotoId === undefined ? person.coverPhotoId : body.coverPhotoId},
      updated_at = now()
    where id = ${personId}
    returning
      id,
      owner_user_id as "ownerUserId",
      name,
      cover_photo_id as "coverPhotoId",
      is_hidden as "isHidden",
      is_favorite as "isFavorite",
      birth_date as "birthDate",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `)

  const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : result
  return Array.isArray(rows) ? rows[0] : rows
})
