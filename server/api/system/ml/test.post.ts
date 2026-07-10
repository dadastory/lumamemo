import { z } from 'zod'
import {
  assertJinaImageEmbeddingModel,
  createMachineLearningClient,
  createMachineLearningTestImage,
  createMachineLearningTestImageMetadata,
  formatMachineLearningError,
  getMachineLearningSettings,
  resolveMachineLearningLanguageName,
  serializeMachineLearningError,
  type MachineLearningSettings,
} from '~~/server/services/ml/client'

const bodySchema = z.object({
  capability: z.enum(['vlm', 'embedding', 'face']),
  settings: z.record(z.string(), z.any()).optional().default({}),
})

const normalizeSettingValue = (value: unknown) =>
  value &&
  typeof value === 'object' &&
  'value' in (value as Record<string, unknown>)
    ? (value as Record<string, unknown>).value
    : value

const readStringSetting = (
  snapshot: Record<string, unknown>,
  key: string,
  fallback: string,
) => {
  const value = normalizeSettingValue(snapshot[key])
  return typeof value === 'string' ? value.trim() : fallback
}

const createSettingsFromSnapshot = async (
  snapshot: Record<string, unknown>,
): Promise<MachineLearningSettings> => {
  const base = await getMachineLearningSettings()
  return {
    ...base,
    language: readStringSetting(snapshot, 'ml.language', base.language),
    localAiBaseUrl: readStringSetting(
      snapshot,
      'ml.localAiBaseUrl',
      base.localAiBaseUrl,
    ),
    vlmProvider: readStringSetting(snapshot, 'ml.vlmProvider', base.vlmProvider),
    vlmBaseUrl: readStringSetting(snapshot, 'ml.vlmBaseUrl', base.vlmBaseUrl),
    vlmApiKey: readStringSetting(snapshot, 'ml.vlmApiKey', base.vlmApiKey),
    vlmModel: readStringSetting(snapshot, 'ml.vlmModel', base.vlmModel),
    embeddingBaseUrl: readStringSetting(
      snapshot,
      'ml.embeddingBaseUrl',
      base.embeddingBaseUrl,
    ),
    embeddingApiKey: readStringSetting(
      snapshot,
      'ml.embeddingApiKey',
      base.embeddingApiKey,
    ),
    embeddingModel: readStringSetting(
      snapshot,
      'ml.embeddingModel',
      base.embeddingModel,
    ),
    faceModel: readStringSetting(snapshot, 'ml.faceModel', base.faceModel),
  }
}

const getVlmBaseUrlForResult = (settings: MachineLearningSettings) =>
  settings.vlmProvider === 'localai'
    ? settings.localAiBaseUrl
    : settings.vlmBaseUrl

const extractServiceErrorMessage = (body: unknown): string | null => {
  if (!body) return null
  if (typeof body === 'string') return body
  if (typeof body !== 'object') return String(body)

  const record = body as Record<string, any>
  const detail = record.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message
    if (typeof detail.error === 'string') return detail.error
  }
  if (typeof record.message === 'string') return record.message
  if (typeof record.error === 'string') return record.error
  return JSON.stringify(body)
}

const formatProbeFailure = (
  service: string,
  status: number | null,
  body: unknown,
) => {
  const message = extractServiceErrorMessage(body)
  return `${service} test request failed${
    status ? ` (${status})` : ''
  }${message ? `: ${message}` : ''}`
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const startedAt = Date.now()
  const settings = await createSettingsFromSnapshot(body.settings)
  const client = createMachineLearningClient(settings)

  const baseResult = {
    capability: body.capability,
    durationMs: 0,
  }

  try {
    if (body.capability === 'vlm') {
      if (!settings.vlmModel) throw new Error('Vision model is not configured')
      const analysis = await client.describeImage(
        createMachineLearningTestImage(),
        settings.vlmModel,
        resolveMachineLearningLanguageName(settings.language),
      )
      return {
        ...baseResult,
        ok: true,
        provider: settings.vlmProvider,
        baseUrl: getVlmBaseUrlForResult(settings),
        model: settings.vlmModel,
        requestedModel: settings.vlmModel,
        durationMs: Date.now() - startedAt,
        status: 200,
        details: {
          caption: analysis.caption,
          tags: analysis.tags?.length || 0,
        },
      }
    }

    if (body.capability === 'embedding') {
      if (!settings.embeddingModel) {
        throw new Error('Embedding model is not configured')
      }
      const requestedModel = assertJinaImageEmbeddingModel(
        settings.embeddingModel,
      )
      const text = await client.testTextEmbedding(requestedModel)
      const image = await client.testImageEmbedding(requestedModel)
      if (text.embeddingDim !== image.embeddingDim) {
        throw new Error(
          `Embedding dimensions differ: text=${text.embeddingDim}, image=${image.embeddingDim}`,
        )
      }
      return {
        ...baseResult,
        ok: true,
        provider: 'jina',
        baseUrl: settings.embeddingBaseUrl,
        model: requestedModel,
        requestedModel,
        durationMs: Date.now() - startedAt,
        status: 200,
        details: {
          textEmbeddingDim: text.embeddingDim,
          imageEmbeddingDim: image.embeddingDim,
          testImage: createMachineLearningTestImageMetadata(),
        },
      }
    }

    if (!settings.faceModel) throw new Error('Face model is not configured')
    const probe = await client.probeFaceModel(settings.faceModel)
    return {
      ...baseResult,
      ok: probe.ok,
      provider: 'localai',
      baseUrl: settings.localAiBaseUrl,
      model: settings.faceModel,
      requestedModel: settings.faceModel,
      durationMs: Date.now() - startedAt,
      status: probe.status,
      error: probe.ok
        ? null
        : formatProbeFailure('Face model', probe.status, probe.body),
      details: {
        response: probe.body,
        testImage: createMachineLearningTestImageMetadata(),
      },
    }
  } catch (error) {
    const requestedModel =
      body.capability === 'vlm'
        ? settings.vlmModel
        : body.capability === 'embedding'
          ? settings.embeddingModel
          : settings.faceModel
    return {
      ...baseResult,
      ok: false,
      provider:
        body.capability === 'vlm'
          ? settings.vlmProvider
          : body.capability === 'embedding'
            ? 'jina'
            : 'localai',
      baseUrl:
        body.capability === 'vlm'
          ? getVlmBaseUrlForResult(settings)
          : body.capability === 'embedding'
            ? settings.embeddingBaseUrl
            : settings.localAiBaseUrl,
      model: requestedModel,
      requestedModel,
      durationMs: Date.now() - startedAt,
      status: null,
      error: formatMachineLearningError(error),
      details: serializeMachineLearningError(error),
    }
  }
})
