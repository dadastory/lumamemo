import { and, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { getMachineLearningSettings } from '~~/server/services/ml/client'
import { createVectorStore } from '~~/server/services/ml/vector-store'
import { getDatabaseProvider } from '~~/server/utils/db'
import { encodeStorageKeyPath } from '~~/server/utils/security'

const photosApiLogger = logger.dynamic('photos-api')

const normalizeRows = (result: any): any[] => {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.rows)) return result.rows
  if (Array.isArray(result?.[0])) return result[0]
  return []
}

const defaultMachineLearningStatus = (state = 'not-indexed') => ({
  state,
  hasEmbedding: false,
  autoTagCount: 0,
  faceCount: 0,
  personCount: 0,
  autoTags: [],
  stages: {
    autoTags: { state: state === 'unsupported' ? 'unsupported' : 'missing', count: 0, task: null },
    semantic: { state: state === 'unsupported' ? 'unsupported' : 'missing', hasEmbedding: false, task: null },
    description: { state: state === 'unsupported' ? 'unsupported' : 'missing', hasDescription: false, task: null },
    faces: { state: state === 'unsupported' ? 'unsupported' : 'missing', count: 0, task: null },
    people: { state: state === 'unsupported' ? 'unsupported' : 'missing', count: 0, task: null },
  },
  latestTask: null,
})

const applyDefaultMachineLearningMetadata = (
  photos: any[],
  state = getDatabaseProvider() === 'postgres' ? 'not-indexed' : 'unsupported',
) => {
  for (const photo of photos) {
    photo.photoFaces = photo.photoFaces || []
    photo.mlStatus = photo.mlStatus || defaultMachineLearningStatus(state)
  }
}

const attachMachineLearningMetadata = async (
  db: any,
  serialized: any[],
  ownerUserId: number,
) => {
  if (getDatabaseProvider() !== 'postgres') {
    applyDefaultMachineLearningMetadata(serialized, 'unsupported')
    return
  }

  if (serialized.length === 0) return

  const photoIds = serialized.map((photo) => photo.id)
  const settings = await getMachineLearningSettings()
  const vectorStore = createVectorStore(settings)
  const rows = await vectorStore.listFacePayloads({
    ownerUserId,
    photoIds,
    includeUnassigned: true,
  })
  const personIds = Array.from(
    new Set(rows.map((face) => face.personId).filter(Boolean)),
  ) as number[]
  const peopleRows =
    personIds.length > 0
      ? await db
          .select({
            id: (tables as any).people.id,
            name: (tables as any).people.name,
            isHidden: (tables as any).people.isHidden,
          })
          .from((tables as any).people)
          .where(
            and(
              inArray((tables as any).people.id, personIds),
              eq((tables as any).people.ownerUserId, ownerUserId),
            ),
          )
          .all()
      : []
  const peopleById = new Map(peopleRows.map((person: any) => [Number(person.id), person]))
  const facesByPhotoId = new Map<string, any[]>()
  for (const face of rows) {
    const list = facesByPhotoId.get(face.photoId) || []
    const person = face.personId ? peopleById.get(face.personId) : null
    list.push({
      ...face,
      id: face.faceId,
      cropUrl: encodeStorageKeyPath(face.cropStorageKey),
      personName: person?.name ?? null,
      personIsHidden: person?.isHidden ?? null,
    })
    facesByPhotoId.set(face.photoId, list)
  }
  for (const photo of serialized) {
    photo.photoFaces = facesByPhotoId.get(photo.id) || []
  }

  const latestTaskRows = normalizeRows(
    await db.execute(sql`
      select *
      from (
        select
          p.id as "photoId",
          pipeline_queue.payload->>'type' as "taskType",
          pipeline_queue.id,
          pipeline_queue.status,
          pipeline_queue.status_stage,
          pipeline_queue.error_message,
          pipeline_queue.attempts,
          pipeline_queue.max_attempts,
          row_number() over (
            partition by p.id, pipeline_queue.payload->>'type'
            order by pipeline_queue.created_at desc, pipeline_queue.id desc
          ) as rn
        from photos p
        left join pipeline_queue on
          pipeline_queue.payload->>'photoId' = p.id
          and pipeline_queue.payload->>'type' in (
            'photo-ml-auto-tags',
            'photo-ml-semantic-embedding',
            'photo-ai-analysis',
            'photo-face-detect',
            'photo-face-cluster'
          )
        where p.owner_user_id = ${ownerUserId}
      ) latest_tasks
      where rn = 1 and "taskType" is not null
    `),
  )
  const latestOverallTaskRows = normalizeRows(
    await db.execute(sql`
      select
        p.id as "photoId",
        latest_task.id as "latestTaskId",
        latest_task.status as "latestTaskStatus",
        latest_task.status_stage as "latestTaskStage",
        latest_task.error_message as "latestTaskError",
        latest_task.attempts as "latestTaskAttempts",
        latest_task.max_attempts as "latestTaskMaxAttempts"
      from photos p
      left join lateral (
        select
          pipeline_queue.id,
          pipeline_queue.status,
          pipeline_queue.status_stage,
          pipeline_queue.error_message,
          pipeline_queue.attempts,
          pipeline_queue.max_attempts
        from pipeline_queue
        where
          pipeline_queue.payload->>'type' in (
            'photo-ml-index',
            'photo-ml-auto-tags',
            'photo-ml-semantic-embedding',
            'photo-ai-analysis',
            'photo-face-detect',
            'photo-face-cluster'
          )
          and pipeline_queue.payload->>'photoId' = p.id
        order by pipeline_queue.created_at desc, pipeline_queue.id desc
        limit 1
      ) latest_task on true
      where p.owner_user_id = ${ownerUserId}
    `),
  )
  const embeddedPhotoIds = await vectorStore.getPhotoEmbeddingPresence(
    photoIds,
    settings.embeddingModel,
  )
  const mlStatusByPhotoId = new Map<string, any>()
  const taskByPhotoAndType = new Map<string, any>()
  for (const row of latestTaskRows) {
    taskByPhotoAndType.set(`${row.photoId}:${row.taskType}`, {
      id: Number(row.id),
      type: row.taskType,
      status: row.status,
      stage: row.status_stage,
      errorMessage: row.error_message,
      attempts: Number(row.attempts || 0),
      maxAttempts: Number(row.max_attempts || 0),
    })
  }

  const stageFromTask = (task: any, ready: boolean) =>
    task?.status === 'pending' || task?.status === 'in-stages'
      ? 'processing'
      : task?.status === 'failed'
        ? 'failed'
        : ready
          ? 'ready'
          : 'missing'

  for (const row of latestOverallTaskRows) {
    const latestTask = row.latestTaskId
      ? {
          id: Number(row.latestTaskId),
          status: row.latestTaskStatus,
          stage: row.latestTaskStage,
          errorMessage: row.latestTaskError,
          attempts: Number(row.latestTaskAttempts || 0),
          maxAttempts: Number(row.latestTaskMaxAttempts || 0),
        }
      : null
    const hasPhotoEmbedding = embeddedPhotoIds.has(row.photoId)
    const photo = serialized.find((item) => item.id === row.photoId)
    const photoFaces = facesByPhotoId.get(row.photoId) || []
    const autoTagCount = Array.isArray((photo as any)?.aiTags)
      ? (photo as any).aiTags.length
      : 0
    const faceCount = photoFaces.length
    const aiAnalysis = ((photo as any)?.aiAnalysis || {}) as {
      description?: string | null
    }
    const hasDescription = Boolean(aiAnalysis.description)
    const personCount = new Set(
      photoFaces.map((face) => face.personId).filter(Boolean),
    ).size
    const autoTagsTask = taskByPhotoAndType.get(
      `${row.photoId}:photo-ml-auto-tags`,
    )
    const semanticTask = taskByPhotoAndType.get(
      `${row.photoId}:photo-ml-semantic-embedding`,
    )
    const descriptionTask = taskByPhotoAndType.get(
      `${row.photoId}:photo-ai-analysis`,
    )
    const facesTask = taskByPhotoAndType.get(`${row.photoId}:photo-face-detect`)
    const peopleTask = taskByPhotoAndType.get(`${row.photoId}:photo-face-cluster`)
    const stages = {
      autoTags: {
        state: stageFromTask(autoTagsTask, autoTagCount > 0),
        count: autoTagCount,
        task: autoTagsTask || null,
      },
      semantic: {
        state: stageFromTask(semanticTask, hasPhotoEmbedding),
        hasEmbedding: hasPhotoEmbedding,
        task: semanticTask || null,
      },
      description: {
        state: stageFromTask(descriptionTask, hasDescription),
        hasDescription,
        task: descriptionTask || null,
      },
      faces: {
        state: stageFromTask(facesTask, faceCount > 0),
        count: faceCount,
        task: facesTask || null,
      },
      people: {
        state: stageFromTask(peopleTask, personCount > 0),
        count: personCount,
        task: peopleTask || null,
      },
    }
    const state =
      latestTask?.status === 'pending' || latestTask?.status === 'in-stages'
        ? 'processing'
        : latestTask?.status === 'failed'
          ? 'failed'
          : Object.values(stages).some((stage: any) => stage.state === 'ready')
            ? 'indexed'
            : 'not-indexed'

    mlStatusByPhotoId.set(row.photoId, {
      state,
      hasEmbedding: hasPhotoEmbedding,
      autoTagCount,
      faceCount,
      personCount,
      autoTags: [],
      stages,
      latestTask,
    })
  }

  for (const photo of serialized) {
    photo.mlStatus = mlStatusByPhotoId.get(photo.id) || defaultMachineLearningStatus()
  }
}

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)
  const db = useDB()
  const photos = await db
    .select({
      ...getTableColumns(tables.photos),
      ownerId: tables.users.id,
      ownerUsername: tables.users.username,
      ownerAvatar: tables.users.avatar,
    })
    .from(tables.photos)
    .leftJoin(tables.users, eq(tables.photos.ownerUserId, tables.users.id))
    .where(eq(tables.photos.ownerUserId, session.user.id))
    .orderBy(desc(tables.photos.dateTaken))
    .all()

  const serialized = photos.map(serializeAdminPhoto)

  try {
    await attachMachineLearningMetadata(db, serialized, session.user.id)
  } catch (error) {
    photosApiLogger.warn('Failed to attach ML metadata to photo list:', error)
    applyDefaultMachineLearningMetadata(serialized)
  }

  return serialized
})
