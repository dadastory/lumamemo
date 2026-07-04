import { desc } from 'drizzle-orm'
import { serializeInvitation } from '~~/server/utils/invitations'

export default eventHandler(async (event) => {
  await requireAdminSession(event)

  const invitations = await useDB()
    .select()
    .from(tables.userInvites)
    .orderBy(desc(tables.userInvites.createdAt))
    .all()

  return invitations.map(serializeInvitation)
})
