import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  createMachineLearningClient,
  getMachineLearningSettings,
} from '~~/server/services/ml/client'
import { createVectorStore } from '~~/server/services/ml/vector-store'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import {
  assertMachineLearningAvailable,
  assertMachineLearningEnabled,
} from '~~/server/utils/ml-capabilities'
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
    `Semantic search unavailable: ${
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
  const session = await requireActiveUserSession(event)

  const query = await getValidatedQuery(
    event,
    z.object({
      q: z.string().trim().min(1).max(200),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }).parse,
  )

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
      ownerUserId: session.user.id,
      limit: query.limit,
      minScore: DEFAULT_SEMANTIC_MIN_SCORE,
    })
    ids = filterSemanticMatches(matches).map((match) => match.photoId)
  } catch (error) {
    return semanticUnavailableResponse(query.q, error)
  }

  const photos = ids.length
    ? await useDB()
        .select()
        .from(tables.photos)
        .where(inArray(tables.photos.id, ids))
        .all()
    : []
  const order = new Map(ids.map((id, index) => [id, index]))

  return {
    query: query.q,
    results: photos.sort(
      (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
    ),
  }
})
