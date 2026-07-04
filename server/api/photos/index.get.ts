import { desc, getTableColumns } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const db = useDB()
  const query = db
    .select({
      ...getTableColumns(tables.photos),
      ownerId: tables.users.id,
      ownerUsername: tables.users.username,
      ownerAvatar: tables.users.avatar,
    })
    .from(tables.photos)
    .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))

  const photos = await query
    .where(eq(tables.photos.ownerUserId, session.user.id))
    .orderBy(desc(tables.photos.dateTaken))
    .all()

  return photos.map(serializeAdminPhoto)
})
