import { checkMachineLearningVectorStore } from '../services/ml/vector-store'
import { settingsManager } from '../services/settings/settingsManager'
import { getDatabaseProvider } from './db'

const isTruthy = (value: unknown) =>
  value === true || value === 'true' || value === 1 || value === '1'

const isBlankString = (value: unknown) =>
  typeof value !== 'string' || value.trim().length === 0

export const assertMachineLearningAvailable = async () => {
  if (getDatabaseProvider() !== 'postgres') {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Machine learning requires PostgreSQL for metadata and Qdrant for vectors.',
    })
  }

  const health = await checkMachineLearningVectorStore()
  if (!health.ok) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Machine learning requires a reachable Qdrant vector store.',
    })
  }
}

export const isMachineLearningEnabled = async () =>
  (await settingsManager.get<boolean>('system', 'ml.enabled')) ?? false

export const assertMachineLearningEnabled = async (
  statusMessage = 'Machine learning is disabled',
) => {
  if (await isMachineLearningEnabled()) return

  throw createError({
    statusCode: 409,
    statusMessage,
  })
}

export const isMachineLearningFeatureEnabled = async (key: string) => {
  if (!(await isMachineLearningEnabled())) return false
  return (await settingsManager.get<boolean>('system', key as any)) ?? false
}

export const assertMachineLearningFeatureEnabled = async (
  key: string,
  statusMessage = 'Machine learning feature is disabled',
) => {
  if (await isMachineLearningFeatureEnabled(key)) return

  throw createError({
    statusCode: 409,
    statusMessage,
  })
}

export const assertMachineLearningCanBeEnabled = async (
  namespace: string,
  key: string,
  value: unknown,
) => {
  if (namespace === 'system' && key === 'ml.enabled' && isTruthy(value)) {
    await assertMachineLearningAvailable()
  }
}

export const assertMachineLearningSemanticSettingsValid = async (
  updates: Array<{ namespace: string; key: string; value: unknown }>,
) => {
  const systemUpdates = new Map(
    updates
      .filter((update) => update.namespace === 'system')
      .map((update) => [update.key, update.value]),
  )

  const readSetting = async <T>(key: string, fallback: T) =>
    systemUpdates.has(key)
      ? (systemUpdates.get(key) as T)
      : ((await settingsManager.get<T>('system', key as any)) ?? fallback)

  const mlEnabled = isTruthy(await readSetting('ml.enabled', false))
  const semanticEnabled = isTruthy(
    await readSetting('ml.semanticSearch.enabled', true),
  )
  if (!mlEnabled || !semanticEnabled) return

  const embeddingBaseUrl = await readSetting('ml.embeddingBaseUrl', '')
  const embeddingApiKey = await readSetting('ml.embeddingApiKey', '')
  const embeddingModel = await readSetting('ml.embeddingModel', '')
  if (
    isBlankString(embeddingBaseUrl) ||
    isBlankString(embeddingApiKey) ||
    isBlankString(embeddingModel)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Semantic search requires a Jina base URL, API key, and model.',
    })
  }
}
