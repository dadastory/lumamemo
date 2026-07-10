import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { people as postgresPeople } from '~~/server/database/schema/postgres'
import { getVectorStore } from '~~/server/services/ml/vector-store'
import { getDatabaseProvider, tables, useDB } from '~~/server/utils/db'
import { logger } from '~~/server/utils/logger'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

const mlTaskTypes = new Set([
  'photo-ml-index',
  'photo-ml-backfill',
  'photo-ml-auto-tags',
  'photo-ml-semantic-embedding',
  'photo-ai-analysis',
  'photo-face-detect',
  'photo-face-cluster',
])

const bodySchema = z
  .object({
    scope: z.enum(['photo', 'user', 'all']),
    photoId: z.string().min(1).optional(),
    userId: z.number().int().positive().optional(),
    includeEditedPeople: z.boolean().optional().default(false),
    includeQueueTasks: z.boolean().optional().default(true),
  })
  .superRefine((body, context) => {
    if (body.scope === 'photo' && !body.photoId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['photoId'],
        message: 'photoId is required for photo cleanup',
      })
    }
    if (body.scope === 'user' && !body.userId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userId'],
        message: 'userId is required for user cleanup',
      })
    }
  })

const isInactiveQueueStatus = (status: string | null | undefined) =>
  status === 'completed' || status === 'failed'

const payloadMatchesCleanupScope = (
  payload: any,
  body: z.infer<typeof bodySchema>,
  photoIds: Set<string>,
) => {
  if (!payload || !mlTaskTypes.has(payload.type)) return false
  if (body.scope === 'all') return true
  if (body.scope === 'user') {
    return (
      Number(payload.ownerUserId) === body.userId ||
      (typeof payload.photoId === 'string' && photoIds.has(payload.photoId))
    )
  }
  return typeof payload.photoId === 'string' && photoIds.has(payload.photoId)
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  if (getDatabaseProvider() !== 'postgres') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Machine learning cleanup requires PostgreSQL',
    })
  }

  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDB()
  const { storageProvider } = useStorageProvider(event)
  const vectorStore = await getVectorStore()

  const photosQuery = db.select().from(tables.photos)
  const photos =
    body.scope === 'photo'
      ? await photosQuery.where(eq(tables.photos.id, body.photoId!)).all()
      : body.scope === 'user'
        ? await photosQuery
            .where(eq(tables.photos.ownerUserId, body.userId!))
            .all()
        : await photosQuery.all()

  const photoIds = new Set<string>(photos.map((photo: any) => photo.id))
  const cleanupPhotoIds = new Set(photoIds)
  if (body.scope === 'photo' && body.photoId) {
    cleanupPhotoIds.add(body.photoId)
  }
  const faceRows =
    photoIds.size > 0
      ? await vectorStore.listFacePayloads({
          photoIds: [...photoIds],
          includeUnassigned: true,
        })
      : []

  const cleanupErrors: Array<{ target: string; message: string }> = []
  let deletedFaceCrops = 0
  for (const face of faceRows) {
    if (!face.cropStorageKey) continue
    try {
      await storageProvider.delete(face.cropStorageKey)
      deletedFaceCrops += 1
    } catch (error) {
      cleanupErrors.push({
        target: face.cropStorageKey,
        message: error instanceof Error ? error.message : String(error),
      })
      logger.image.warn(
        `Failed to delete ML face crop ${face.cropStorageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  for (const photoId of photoIds) {
    await Promise.all([
      vectorStore.deletePhotoEmbeddings(photoId),
      vectorStore.deleteFaceEmbeddingsForPhoto(photoId),
    ])
  }

  for (const photoId of photoIds) {
    await db
      .update(tables.photos)
      .set({ aiTags: null, aiAnalysis: null })
      .where(eq(tables.photos.id, photoId))
      .run()
  }

  const peopleConditions = []
  if (!body.includeEditedPeople) {
    peopleConditions.push(
      isNull(postgresPeople.name),
      eq(postgresPeople.isFavorite, false),
      isNull(postgresPeople.birthDate),
    )
  }
  if (body.scope === 'photo' && cleanupPhotoIds.size > 0) {
    peopleConditions.push(
      inArray(postgresPeople.coverPhotoId, [...cleanupPhotoIds]),
    )
  } else if (body.scope === 'user') {
    peopleConditions.push(eq(postgresPeople.ownerUserId, body.userId!))
  }
  const peopleWhere =
    peopleConditions.length > 0 ? and(...peopleConditions) : undefined
  const peopleRows = peopleWhere
    ? await db.select().from(postgresPeople).where(peopleWhere).all()
    : await db.select().from(postgresPeople).all()
  if (peopleWhere) {
    await db.delete(postgresPeople).where(peopleWhere).run()
  } else {
    await db.delete(postgresPeople).run()
  }

  let deletedQueueTasks = 0
  if (body.includeQueueTasks) {
    const queueItems = await db.select().from(tables.pipelineQueue).all()
    const queueIds = queueItems
      .filter(
        (item: any) =>
          isInactiveQueueStatus(item.status) &&
          payloadMatchesCleanupScope(item.payload, body, cleanupPhotoIds),
      )
      .map((item: any) => item.id)

    for (const taskId of queueIds) {
      await db
        .delete(tables.pipelineQueue)
        .where(eq(tables.pipelineQueue.id, taskId))
        .run()
      deletedQueueTasks += 1
    }
  }

  return {
    ok: cleanupErrors.length === 0,
    scope: body.scope,
    deleted: {
      photos: photoIds.size,
      photoEmbeddings: photoIds.size,
      faceEmbeddings: faceRows.length,
      faceCrops: deletedFaceCrops,
      aiMetadata: photoIds.size,
      people: peopleRows.length,
      queueTasks: deletedQueueTasks,
    },
    errors: cleanupErrors,
  }
})
