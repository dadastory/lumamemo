import { z } from 'zod'

const paramsSchema = z.object({
  inviteId: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value)),
})

export default eventHandler(async (event) => {
  await requireAdminSession(event)
  const { inviteId } = await getValidatedRouterParams(event, paramsSchema.parse)

  const invite = await useDB()
    .delete(tables.userInvites)
    .where(eq(tables.userInvites.id, inviteId))
    .returning()
    .get()

  if (!invite) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invitation not found',
    })
  }

  return { ok: true }
})
