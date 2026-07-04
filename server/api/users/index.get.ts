import { asc } from 'drizzle-orm'

export default eventHandler(async (event) => {
  await requireAdminSession(event)

  const users = await useDB()
    .select()
    .from(tables.users)
    .orderBy(asc(tables.users.createdAt))
    .all()

  return users.map(sanitizeSessionUser)
})
