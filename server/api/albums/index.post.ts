import z from 'zod'
import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)

  const body = await readValidatedBody(
    event,
    z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      coverPhotoId: z.string().optional(),
      photoIds: z.array(z.string()).optional(),
      isHidden: z.boolean().optional(),
    }).parse,
  )

  const db = useDB()
  const photoIds = new Set(body.photoIds || [])

  if (body.coverPhotoId) {
    photoIds.add(body.coverPhotoId)
  }

  for (const photoId of photoIds) {
    const photo = await db
      .select()
      .from(tables.photos)
      .where(
        and(
          eq(tables.photos.id, photoId),
          eq(tables.photos.ownerUserId, session.user.id),
        ),
      )
      .get()

    if (!photo) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot add another user photo to album',
      })
    }
  }

  const album = await db.transaction(async (tx) => {
    const newAlbum = await tx
      .insert(tables.albums)
      .values({
        title: body.title,
        description: body.description || null,
        coverPhotoId: body.coverPhotoId || null,
        ownerUserId: session.user.id,
        isHidden: body.isHidden || false,
      })
      .returning()
      .get()

    const albumId = newAlbum.id
    if (photoIds.size > 0) {
      let pos = 1000000
      for (const photoId of photoIds) {
        await tx
          .insert(tables.albumPhotos)
          .values({
            albumId,
            photoId,
            position: (pos += 10),
          })
          .onConflictDoNothing()
          .run()
      }
    }

    return newAlbum
  })

  await syncPhotoVisibility([...photoIds])

  return album
})
