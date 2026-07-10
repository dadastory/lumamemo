import { desc, eq } from 'drizzle-orm'

const WATCHED_ML_TASK_TYPES = new Set([
  'photo-ml-index',
  'photo-face-detect',
])

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const photoId = getRouterParam(event, 'photoId')
  const afterIdValue = getQuery(event).afterId
  const afterId =
    typeof afterIdValue === 'string' && afterIdValue.trim()
      ? Number(afterIdValue)
      : null

  if (!photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Photo ID is required',
    })
  }

  const db = useDB()
  const photo = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Photo not found',
    })
  }

  if (!canManageOwnedResource(session.user, photo.ownerUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot read another user photo tasks',
    })
  }

  const rows = await db
    .select({
      id: tables.pipelineQueue.id,
      payload: tables.pipelineQueue.payload,
      status: tables.pipelineQueue.status,
      statusStage: tables.pipelineQueue.statusStage,
      errorMessage: tables.pipelineQueue.errorMessage,
      attempts: tables.pipelineQueue.attempts,
      maxAttempts: tables.pipelineQueue.maxAttempts,
      createdAt: tables.pipelineQueue.createdAt,
      completedAt: tables.pipelineQueue.completedAt,
    })
    .from(tables.pipelineQueue)
    .orderBy(desc(tables.pipelineQueue.createdAt))
    .limit(100)
    .all()

  const latestByType = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    const payload = row.payload as any
    const type = payload?.type
    if (
      (afterId !== null && (!Number.isFinite(afterId) || row.id <= afterId)) ||
      payload?.photoId !== photoId ||
      !WATCHED_ML_TASK_TYPES.has(type) ||
      latestByType.has(type)
    ) {
      continue
    }
    latestByType.set(type, row)
  }

  return {
    success: true,
    tasks: Array.from(latestByType.values()).map((task) => ({
      id: task.id,
      type: (task.payload as any)?.type,
      status: task.status,
      statusStage: task.statusStage,
      errorMessage: task.errorMessage,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    })),
  }
})
