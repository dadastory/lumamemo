import { desc } from 'drizzle-orm'

export default eventHandler(async (event) => {
  await requireAdminSession(event)

  return useDB()
    .select()
    .from(tables.photos)
    .orderBy(desc(tables.photos.dateTaken))
    .all()
    .map(serializeAdminPhoto)
})
