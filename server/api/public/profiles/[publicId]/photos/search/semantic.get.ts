import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  createMachineLearningClient,
  getMachineLearningSettings,
} from '~~/server/services/ml/client'
import { createVectorStore } from '~~/server/services/ml/vector-store'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import { canViewOwnerPrivateContent } from '~~/server/utils/public-profile'
import {
  assertMachineLearningAvailable,
  assertMachineLearningEnabled,
} from '~~/server/utils/ml-capabilities'
import { isDisabledUser } from '~~/server/utils/security'
import { logger } from '~~/server/utils/logger'

const semanticSearchLogger = logger.dynamic('semantic-search')
const DEFAULT_SEMANTIC_MIN_SCORE = 0.6
const DEFAULT_SEMANTIC_SCORE_RATIO = 0.94

const filterSemanticMatches = (
  matches: Array<{ photoId: string; score: number }>,
) => {
  if (matches.length === 0) return []
  const bestScore = Math.max(...matches.map((match) => match.score))
  const threshold = Math.max(
    DEFAULT_SEMANTIC_MIN_SCORE,
    bestScore * DEFAULT_SEMANTIC_SCORE_RATIO,
  )
  return matches.filter((match) => match.score >= threshold)
}

const semanticUnavailableResponse = (query: string, error: unknown) => {
  semanticSearchLogger.warn(
    `Public semantic search unavailable: ${
      error instanceof Error ? error.message : String(error)
    }`,
  )

  return {
    query,
    results: [],
    degraded: true,
    reason: 'semantic-unavailable' as const,
  }
}

export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'publicId')
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public profile ID is required',
    })
  }

  const query = await getValidatedQuery(
    event,
    z.object({
      q: z.string().trim().min(1).max(200),
      limit: z.coerce.number().int().min(1).max(100).default(60),
    }).parse,
  )

  const db = useDB()
  const session = await getSafeUserSession(event)
  const user = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.publicId, publicId))
    .get()

  const isOwner = canViewOwnerPrivateContent(session.user, user?.id)
  if (
    !user ||
    isDisabledUser(user) ||
    (user.homepageVisibility !== 'public' && !isOwner)
  ) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  let ids: string[]
  try {
    await assertMachineLearningEnabled()
    const semanticSearchEnabled =
      (await settingsManager.get<boolean>(
        'system',
        'ml.semanticSearch.enabled',
      )) ?? true
    if (!semanticSearchEnabled) {
      throw new Error('Semantic search is disabled')
    }
    await assertMachineLearningAvailable()
    const settings = await getMachineLearningSettings()
    const client = createMachineLearningClient(settings)
    const embeddingModel = settings.embeddingModel
    const embedding = await client.embedText(query.q, embeddingModel)
    const vectorStore = createVectorStore(settings)
    const matches = await vectorStore.searchPhotoEmbeddings({
      embedding,
      modelName: embeddingModel,
      ownerUserId: user.id,
      limit: isOwner ? query.limit : Math.min(query.limit * 3, 100),
      minScore: DEFAULT_SEMANTIC_MIN_SCORE,
    })
    ids = filterSemanticMatches(matches)
      .slice(0, query.limit)
      .map((match) => match.photoId)
  } catch (error) {
    return semanticUnavailableResponse(query.q, error)
  }

  const visibilityCondition = isOwner
    ? undefined
    : eq(tables.photos.visibility, 'public')
  const rows = ids.length
    ? await db
        .select({ id: tables.photos.id })
        .from(tables.photos)
        .where(
          and(
            inArray(tables.photos.id, ids),
            eq(tables.photos.ownerUserId, user.id),
            visibilityCondition,
          ),
        )
        .all()
    : []
  const order = new Map(ids.map((id, index) => [id, index]))

  return {
    query: query.q,
    results: rows.sort(
      (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
    ),
  }
})
