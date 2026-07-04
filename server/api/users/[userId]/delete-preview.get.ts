import { and, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  getPhotoStorageKeys,
  getUserOwnedPhotoStorageKeys,
} from '~~/server/utils/photo-delete'

const paramsSchema = z.object({
  userId: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value)),
})

export default eventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const { userId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDB()

  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  const photos = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.ownerUserId, userId))
    .all()
  const albums = await db
    .select()
    .from(tables.albums)
    .where(eq(tables.albums.ownerUserId, userId))
    .all()
  const invitations = await db
    .select()
    .from(tables.userInvites)
    .where(
      or(
        eq(tables.userInvites.email, user.email),
        eq(tables.userInvites.createdByUserId, userId),
        eq(tables.userInvites.acceptedByUserId, userId),
      ),
    )
    .all()
  const restrictions = getUserDeletionRestrictions(
    session.user,
    user,
    await getActiveAdminCount(db),
  )
  const storageFiles = new Set(
    photos.flatMap((photo: any) => getUserOwnedPhotoStorageKeys(photo, userId)),
  ).size
  const allStorageFiles = [...new Set(photos.flatMap(getPhotoStorageKeys))]
  const skippedStorageFiles = allStorageFiles.length - storageFiles

  return {
    user: sanitizeSessionUser(user),
    restrictions,
    counts: {
      photos: photos.length,
      albums: albums.length,
      invitations: invitations.length,
      storageFiles,
      skippedStorageFiles,
    },
  }
})

async function getActiveAdminCount(db: any) {
  return (
    await db
      .select()
      .from(tables.users)
      .where(
        and(eq(tables.users.role, 'admin'), isNull(tables.users.disabledAt)),
      )
      .all()
  ).length
}
