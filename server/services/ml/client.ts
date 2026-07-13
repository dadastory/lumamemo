import sharp from 'sharp'
import { settingsManager } from '../settings/settingsManager'

export type MachineLearningSettings = {
  language: string
  localAiBaseUrl: string
  vlmProvider: 'openai' | 'openai-compatible' | 'localai' | string
  vlmBaseUrl: string
  vlmApiKey: string
  embeddingBaseUrl: string
  embeddingApiKey: string
  vectorProvider: string
  vectorBaseUrl: string
  vectorApiKey: string
  vectorCollectionPrefix: string
  vlmModel: string
  embeddingModel: string
  faceModel: string
}

export type MachineLearningTag = {
  tag: string
  score: number
}

export type MachineLearningFace = {
  boundingBox?: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  embedding?: number[] | string
  score?: number
}

type EmbeddingResponse = {
  embedding?: number[]
  embeddings?: number[][]
  outputs?: Array<{ embedding?: number[] }>
  data?: Array<{ embedding?: number[] }>
  vector?: number[]
  model?: string
}

type AnalyzeResponse = {
  caption?: string
  description?: string
  evaluation?: string
  tags?: MachineLearningTag[]
  model?: string
}

export type PhotoAiScoreResponse = {
  score?: number
  scoreBreakdown?: {
    composition?: number | null
    lighting?: number | null
    color?: number | null
    sharpness?: number | null
    overall?: number | null
  }
  summary?: string
}

export type PhotoAiCritiqueResponse = {
  evaluation?: string
  strengths?: string[]
}

export type PhotoAiSuggestionsResponse = {
  suggestions?: string[]
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

type HealthResponse = {
  ok: boolean
  status: number | null
  body: unknown
}

type SerializedMachineLearningError = {
  name?: string
  message: string
  code?: string
  reason?: string
  syscall?: string
  address?: string
  port?: number
  cause?: SerializedMachineLearningError
  errors?: SerializedMachineLearningError[]
}

const LOCALAI_DEFAULT_BASE_URL =
  process.env.ML_LOCALAI_BASE_URL || 'http://lumamemo-localai:8080'
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const JINA_DEFAULT_BASE_URL = 'https://api.jina.ai/v1'
const JINA_IMAGE_EMBEDDING_MODELS = new Set([
  'jina-embeddings-v4',
  'jina-embeddings-v5-omni-small',
  'jina-embeddings-v5-omni-nano',
  'jina-clip-v1',
  'jina-clip-v2',
])

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

const toNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const pickNumber = (...values: unknown[]) => {
  for (const value of values) {
    const number = toNumber(value)
    if (number !== null) return number
  }
  return null
}

export const parseEmbeddingString = (value: string) => {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(Number) : []
  } catch {
    return []
  }
}

const coerceEmbedding = (payload: EmbeddingResponse | number[] | unknown) => {
  if (
    Array.isArray(payload) &&
    payload.every((value) => typeof value === 'number')
  ) {
    return payload
  }

  const response = payload as EmbeddingResponse
  if (Array.isArray(response.embedding)) return response.embedding
  if (Array.isArray(response.vector)) return response.vector
  if (Array.isArray(response.embeddings?.[0])) return response.embeddings[0]
  if (Array.isArray(response.outputs?.[0]?.embedding)) {
    return response.outputs[0].embedding
  }
  if (Array.isArray(response.data?.[0]?.embedding))
    return response.data[0].embedding

  return []
}

const readMachineLearningSetting = async <T>(
  key: string,
  fallback: T,
): Promise<T> => {
  const value = await settingsManager.get<T>('system', key as any)
  return value ?? fallback
}

const normalizeRequiredSettingValue = <T>(value: T | null, fallback: T): T => {
  if (typeof value === 'string' && value.trim() === '') return fallback
  return value ?? fallback
}

const readRequiredMachineLearningSetting = async <T>(
  key: string,
  fallback: T,
): Promise<T> => {
  const value = await settingsManager.get<T>('system', key as any)
  return normalizeRequiredSettingValue(value, fallback)
}

const getAuthHeaders = (apiKey?: string) =>
  apiKey ? { Authorization: `Bearer ${apiKey}` } : {}

const normalizeProvider = (provider: string) =>
  provider.trim().toLowerCase() || 'openai-compatible'

const isLocalAiProvider = (provider: string) =>
  normalizeProvider(provider) === 'localai'

const isOpenAiProvider = (provider: string) =>
  normalizeProvider(provider) === 'openai'

const getProviderBaseUrl = (
  provider: string,
  configuredBaseUrl: string,
  localAiBaseUrl: string,
) => {
  const normalized = normalizeProvider(provider)
  if (normalized === 'localai') return localAiBaseUrl
  if (normalized === 'openai')
    return configuredBaseUrl || OPENAI_DEFAULT_BASE_URL
  return configuredBaseUrl
}

const getProviderHeaders = (provider: string, apiKey?: string) =>
  isLocalAiProvider(provider) ? {} : getAuthHeaders(apiKey)

const imageToDataUrl = (image: Uint8Array | Buffer) => {
  const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image)
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

const imageToBase64 = (image: Uint8Array | Buffer) => {
  const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image)
  return buffer.toString('base64')
}

const imageBufferToDataUrl = (buffer: Buffer, mime = 'image/jpeg') =>
  `data:${mime};base64,${buffer.toString('base64')}`

const FACE_EMBEDDING_CROP_PADDING = 0.35
const MAX_ERROR_BODY_LENGTH = 1200

const truncateErrorBody = (value: string) =>
  value.length > MAX_ERROR_BODY_LENGTH
    ? `${value.slice(0, MAX_ERROR_BODY_LENGTH)}...`
    : value

const readResponseBody = async (response: Response) => {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const stringifyResponseBody = (body: unknown) =>
  typeof body === 'string' ? body : JSON.stringify(body)

const formatRequestFailureBody = (body: unknown) => {
  const value = stringifyResponseBody(body)
  if (!value) return ''
  const suffix = value.includes('Failed to load base64 image')
    ? ' Jina image embedding received a raw base64 image. Verify the selected model supports image inputs and the service can decode JPEG payloads.'
    : ''
  return `${truncateErrorBody(value)}${suffix}`
}

export const assertJinaImageEmbeddingModel = (modelName: string) => {
  const normalized = modelName.trim()
  if (!normalized) {
    throw new Error('Machine learning embedding model is not configured')
  }
  if (JINA_IMAGE_EMBEDDING_MODELS.has(normalized)) return normalized
  throw new Error(
    `Jina model "${normalized}" is not supported for photo image embedding. Use a multimodal image embedding model such as jina-embeddings-v5-omni-small.`,
  )
}

export const TEST_FACE_IMAGE_SOURCE =
  'scikit-image astronaut crop, derived from NASA public domain imagery'
export const TEST_FACE_IMAGE_BASE64 =
  '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'

export const createMachineLearningTestImage = () =>
  Buffer.from(TEST_FACE_IMAGE_BASE64, 'base64')

export const createMachineLearningTestImageMetadata = () => ({
  source: TEST_FACE_IMAGE_SOURCE,
  width: 128,
  height: 151,
  mime: 'image/jpeg',
})

const serializeErrorValue = (
  error: unknown,
  depth = 0,
): SerializedMachineLearningError => {
  if (depth > 3) return { message: 'Nested error omitted' }
  if (!error || typeof error !== 'object') return { message: String(error) }

  const record = error as Record<string, any>
  const serialized: SerializedMachineLearningError = {
    name: typeof record.name === 'string' ? record.name : undefined,
    message:
      typeof record.message === 'string'
        ? record.message
        : String(error),
    code: typeof record.code === 'string' ? record.code : undefined,
    reason: typeof record.reason === 'string' ? record.reason : undefined,
    syscall: typeof record.syscall === 'string' ? record.syscall : undefined,
    address: typeof record.address === 'string' ? record.address : undefined,
    port: typeof record.port === 'number' ? record.port : undefined,
  }
  if (record.cause) {
    serialized.cause = serializeErrorValue(record.cause, depth + 1)
  }
  if (Array.isArray(record.errors)) {
    serialized.errors = record.errors
      .slice(0, 4)
      .map((item) => serializeErrorValue(item, depth + 1))
  }
  return serialized
}

const collectErrorParts = (
  error: SerializedMachineLearningError,
  parts: string[] = [],
) => {
  const detail = [error.code, error.reason, error.syscall, error.address]
    .filter(Boolean)
    .join(' ')
  parts.push(detail ? `${error.message} (${detail})` : error.message)
  if (error.cause) collectErrorParts(error.cause, parts)
  for (const nested of error.errors || []) collectErrorParts(nested, parts)
  return parts
}

export const serializeMachineLearningError = (error: unknown) =>
  serializeErrorValue(error)

export const formatMachineLearningError = (error: unknown) =>
  Array.from(new Set(collectErrorParts(serializeMachineLearningError(error))))
    .join(' / ')
    .slice(0, 2000)

const MACHINE_LEARNING_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-CN': 'Simplified Chinese',
  'zh-Hans': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'zh-Hant-TW': 'Traditional Chinese',
  'zh-HK': 'Traditional Chinese',
  'zh-Hant-HK': 'Traditional Chinese',
  ja: 'Japanese',
}

export const resolveMachineLearningLanguage = async () => {
  const configured =
    (await settingsManager.get<string>('system', 'ml.language')) ||
    (await settingsManager.get<string>('location', 'language')) ||
    'en'
  const languageName = resolveMachineLearningLanguageName(configured)

  return {
    code: configured,
    languageName,
  }
}

export const resolveMachineLearningLanguageName = (code: string) =>
  MACHINE_LEARNING_LANGUAGE_NAMES[code] ||
  MACHINE_LEARNING_LANGUAGE_NAMES[code.split('-')[0] || ''] ||
  'English'

const extractJsonObject = (content: string) => {
  const trimmed = content.trim()
  if (trimmed.startsWith('{')) return trimmed
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match?.[0] || trimmed
}

const postJson = async <T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => {
  return postJsonUrl<T>(new URL(path, normalizeBaseUrl(baseUrl)), body, headers)
}

const postJsonUrl = async <T>(
  url: URL,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const responseBody = await readResponseBody(response)
    const formattedBody = responseBody
      ? formatRequestFailureBody(responseBody)
      : ''
    throw new Error(
      `Machine learning request failed: ${url.pathname} ${response.status}${
        formattedBody ? ` ${formattedBody}` : ''
      }`,
    )
  }

  return (await response.json()) as T
}

export const normalizeLocalAiFaceDetections = (
  payload: unknown,
): MachineLearningFace[] => {
  const response = payload as any
  const detections = Array.isArray(response)
    ? response
    : Array.isArray(response?.faces)
      ? response.faces
      : Array.isArray(response?.detections)
        ? response.detections
        : Array.isArray(response?.data)
          ? response.data
          : []

  return detections
    .map((face: any) => {
      const region =
        face?.region || face?.area || face?.box || face?.bbox || face
      const x = pickNumber(
        region?.x,
        region?.left,
        Array.isArray(region) ? region[0] : null,
      )
      const y = pickNumber(
        region?.y,
        region?.top,
        Array.isArray(region) ? region[1] : null,
      )
      const width = pickNumber(
        region?.w,
        region?.width,
        Array.isArray(region) && region.length >= 4
          ? Number(region[2]) - Number(region[0])
          : null,
      )
      const height = pickNumber(
        region?.h,
        region?.height,
        Array.isArray(region) && region.length >= 4
          ? Number(region[3]) - Number(region[1])
          : null,
      )

      if (x === null || y === null || width === null || height === null)
        return null
      if (width <= 0 || height <= 0) return null

      return {
        boundingBox: {
          x1: x,
          y1: y,
          x2: x + width,
          y2: y + height,
        },
        score:
          pickNumber(
            face?.score,
            face?.confidence,
            face?.face_confidence,
            face?.probability,
          ) ?? 0,
      }
    })
    .filter(Boolean) as MachineLearningFace[]
}

export const normalizeLocalAiFaceEmbedding = (payload: unknown) => {
  const response = payload as any
  return coerceEmbedding(response)
}

const cropFaceImage = async (
  image: Uint8Array | Buffer,
  boundingBox: NonNullable<MachineLearningFace['boundingBox']>,
) => {
  const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image)
  const metadata = await sharp(buffer, { limitInputPixels: false }).metadata()
  const imageWidth = metadata.width || 0
  const imageHeight = metadata.height || 0
  if (!imageWidth || !imageHeight) return buffer

  const boxWidth = boundingBox.x2 - boundingBox.x1
  const boxHeight = boundingBox.y2 - boundingBox.y1
  const padX = boxWidth * FACE_EMBEDDING_CROP_PADDING
  const padY = boxHeight * FACE_EMBEDDING_CROP_PADDING
  const x1 = Math.max(0, Math.floor(boundingBox.x1 - padX))
  const y1 = Math.max(0, Math.floor(boundingBox.y1 - padY))
  const x2 = Math.min(imageWidth, Math.ceil(boundingBox.x2 + padX))
  const y2 = Math.min(imageHeight, Math.ceil(boundingBox.y2 + padY))
  const width = x2 - x1
  const height = y2 - y1
  if (width <= 0 || height <= 0) return buffer

  return await sharp(buffer, { limitInputPixels: false })
    .extract({ left: x1, top: y1, width, height })
    .jpeg({ quality: 92 })
    .toBuffer()
}

export const getMachineLearningSettings =
  async (): Promise<MachineLearningSettings> => {
    const localAiBaseUrl = await readRequiredMachineLearningSetting(
      'ml.localAiBaseUrl',
      LOCALAI_DEFAULT_BASE_URL,
    )
    const vlmProvider = await readMachineLearningSetting(
      'ml.vlmProvider',
      process.env.ML_VLM_PROVIDER || 'openai-compatible',
    )

    return {
      language: await readMachineLearningSetting('ml.language', 'en'),
      localAiBaseUrl,
      vlmProvider,
      vlmBaseUrl: await readMachineLearningSetting(
        'ml.vlmBaseUrl',
        process.env.ML_VLM_BASE_URL ||
          (isOpenAiProvider(vlmProvider) ? OPENAI_DEFAULT_BASE_URL : ''),
      ),
      vlmApiKey: await readMachineLearningSetting(
        'ml.vlmApiKey',
        process.env.ML_VLM_API_KEY || '',
      ),
      embeddingBaseUrl: await readMachineLearningSetting(
        'ml.embeddingBaseUrl',
        process.env.ML_EMBEDDING_BASE_URL || JINA_DEFAULT_BASE_URL,
      ),
      embeddingApiKey: await readMachineLearningSetting(
        'ml.embeddingApiKey',
        process.env.ML_EMBEDDING_API_KEY || '',
      ),
      vectorProvider: await readMachineLearningSetting(
        'ml.vectorProvider',
        process.env.ML_VECTOR_PROVIDER || 'qdrant',
      ),
      vectorBaseUrl: await readMachineLearningSetting(
        'ml.vectorBaseUrl',
        process.env.ML_VECTOR_BASE_URL || 'http://lumamemo-qdrant:6333',
      ),
      vectorApiKey: await readMachineLearningSetting(
        'ml.vectorApiKey',
        process.env.ML_VECTOR_API_KEY || '',
      ),
      vectorCollectionPrefix: await readMachineLearningSetting(
        'ml.vectorCollectionPrefix',
        process.env.ML_VECTOR_COLLECTION_PREFIX || 'lumamemo',
      ),
      vlmModel: await readMachineLearningSetting(
        'ml.vlmModel',
        process.env.ML_VLM_MODEL || '',
      ),
      embeddingModel: await readMachineLearningSetting(
        'ml.embeddingModel',
        process.env.ML_EMBEDDING_MODEL || '',
      ),
      faceModel: await readMachineLearningSetting(
        'ml.faceModel',
        process.env.ML_FACE_MODEL || '',
      ),
    }
  }

export class MachineLearningClient {
  readonly language: string
  readonly localAiBaseUrl: string
  readonly vlmProvider: string
  readonly vlmBaseUrl: string
  readonly vlmApiKey: string
  readonly embeddingBaseUrl: string
  readonly embeddingApiKey: string
  readonly vectorProvider: string
  readonly vectorBaseUrl: string
  readonly vectorApiKey: string
  readonly vectorCollectionPrefix: string
  readonly vlmModel: string
  readonly embeddingModel: string
  readonly faceModel: string

  constructor(settings: MachineLearningSettings) {
    this.language = settings.language
    this.localAiBaseUrl = settings.localAiBaseUrl
    this.vlmProvider = settings.vlmProvider
    this.vlmBaseUrl = settings.vlmBaseUrl
    this.vlmApiKey = settings.vlmApiKey
    this.embeddingBaseUrl = settings.embeddingBaseUrl
    this.embeddingApiKey = settings.embeddingApiKey
    this.vectorProvider = settings.vectorProvider
    this.vectorBaseUrl = settings.vectorBaseUrl
    this.vectorApiKey = settings.vectorApiKey
    this.vectorCollectionPrefix = settings.vectorCollectionPrefix
    this.vlmModel = settings.vlmModel
    this.embeddingModel = settings.embeddingModel
    this.faceModel = settings.faceModel
  }

  private getVlmBaseUrl() {
    return getProviderBaseUrl(
      this.vlmProvider,
      this.vlmBaseUrl,
      this.localAiBaseUrl,
    )
  }

  private getVlmHeaders() {
    return getProviderHeaders(this.vlmProvider, this.vlmApiKey)
  }

  private getEmbeddingBaseUrl() {
    return this.embeddingBaseUrl || JINA_DEFAULT_BASE_URL
  }

  private getEmbeddingHeaders() {
    return getAuthHeaders(this.embeddingApiKey)
  }

  async checkHealth() {
    const localAiNeeded =
      isLocalAiProvider(this.vlmProvider) || Boolean(this.faceModel)
    const localAi = localAiNeeded
      ? await fetch(new URL('v1/models', normalizeBaseUrl(this.localAiBaseUrl)))
          .then(
            async (response): Promise<HealthResponse> => ({
              ok: response.ok,
              status: response.status,
              body: await response.json().catch(() => null),
            }),
          )
          .catch(
            (error): HealthResponse => ({
              ok: false,
              status: null,
              body: {
                error: formatMachineLearningError(error),
                details: serializeMachineLearningError(error),
              },
            }),
          )
      : {
          ok: true,
          status: null,
          body: { provider: 'localai', configured: false, skipped: true },
        }

    const vlmConfigured = isLocalAiProvider(this.vlmProvider)
      ? Boolean(this.localAiBaseUrl && this.vlmModel)
      : Boolean(this.vlmBaseUrl && this.vlmApiKey && this.vlmModel)
    const embeddingConfigured = Boolean(
      this.getEmbeddingBaseUrl() && this.embeddingApiKey && this.embeddingModel,
    )
    const embeddingProbe = embeddingConfigured
      ? await this.probeImageEmbedding().catch(
          (error): HealthResponse => ({
            ok: false,
            status: null,
            body: {
              error: formatMachineLearningError(error),
              details: serializeMachineLearningError(error),
            },
          }),
        )
      : {
          ok: false,
          status: null,
          body: { provider: 'jina', configured: false },
        }
    const vlmProbe = vlmConfigured
      ? await this.probeChatCompletion(this.vlmModel).catch(
          (error): HealthResponse => ({
            ok: false,
            status: null,
            body: {
              error: formatMachineLearningError(error),
              details: serializeMachineLearningError(error),
            },
          }),
        )
      : {
          ok: false,
          status: null,
          body: { provider: this.vlmProvider, configured: false },
        }
    const faceConfigured = Boolean(this.localAiBaseUrl && this.faceModel)
    const faceProbe = faceConfigured
      ? await this.probeFaceModel(this.faceModel).catch(
          (error): HealthResponse => ({
            ok: false,
            status: null,
            body: {
              error: formatMachineLearningError(error),
              details: serializeMachineLearningError(error),
            },
          }),
        )
      : {
          ok: false,
          status: null,
          body: { provider: 'localai', configured: false },
        }

    return {
      localAi,
      embedding: {
        ok: embeddingConfigured,
        status: null,
        body: {
          provider: 'jina',
          configured: embeddingConfigured,
        },
      },
      embeddingProbe,
      face: {
        ok: localAi.ok && faceConfigured,
        status: localAi.status,
        body: { provider: 'localai', configured: faceConfigured },
      },
      faceProbe,
      vlm: {
        ok: isLocalAiProvider(this.vlmProvider)
          ? localAi.ok && vlmConfigured
          : vlmConfigured,
        status: isLocalAiProvider(this.vlmProvider) ? localAi.status : null,
        body: { provider: this.vlmProvider, configured: vlmConfigured },
      },
      vlmProbe,
    }
  }

  async analyzeImage(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName?: string,
  ) {
    const description = await this.describeImage(image, modelName, languageName)
    return {
      caption: description.caption,
      tags: description.tags,
      model: modelName,
    }
  }

  private async requestPhotoJson<T>(
    image: Uint8Array | Buffer,
    modelName: string,
    prompt: string,
    failureLabel: string,
  ): Promise<T> {
    const response = await fetch(
      new URL('chat/completions', normalizeBaseUrl(this.getVlmBaseUrl())),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.getVlmHeaders(),
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: imageToDataUrl(image) },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      },
    )

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '')
      throw new Error(
        `${failureLabel} failed: ${response.status}${
          responseBody ? ` ${truncateErrorBody(responseBody)}` : ''
        }`,
      )
    }

    const payload = (await response.json()) as ChatCompletionResponse
    const content = payload.choices?.[0]?.message?.content || ''
    return JSON.parse(extractJsonObject(content)) as T
  }

  async describePhotoForAiAnalysis(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName = 'English',
  ) {
    const parsed = await this.requestPhotoJson<{
      description?: string
      caption?: string
    }>(
      image,
      modelName,
      `Describe this photo for a photography review. Return strict JSON in ${languageName}. ` +
        'Focus on visible subject, scene, light, color, composition, and mood. ' +
        'Schema: {"description":"detailed but concise visual description","caption":"one sentence summary"}',
      'Machine learning AI description',
    )
    return {
      description: parsed.description || parsed.caption || '',
      caption: parsed.caption || parsed.description || '',
      model: modelName,
    }
  }

  async tagPhotoForAiAnalysis(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName = 'English',
  ) {
    const parsed = await this.requestPhotoJson<{ tags?: MachineLearningTag[] }>(
      image,
      modelName,
      `Extract search tags from this photo. Return strict JSON in ${languageName}. ` +
        `All tag text must use ${languageName}; keep proper nouns unchanged when appropriate. ` +
        'Return 5 to 15 short tags. Schema: {"tags":[{"tag":"short tag","score":0.0}]}',
      'Machine learning AI tags',
    )
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      model: modelName,
    }
  }

  async scorePhotoForAiAnalysis(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName = 'English',
  ) {
    const parsed = await this.requestPhotoJson<PhotoAiScoreResponse>(
      image,
      modelName,
      `Give this photo a subjective photography score. Return strict JSON in ${languageName}. ` +
        'Scores must be integers from 0 to 100 and must reflect this specific image, not a copied example. ' +
        'Evaluate composition, lighting, color, sharpness, and overall impression with meaningful variation between photos. ' +
        'Return exactly this JSON shape with integer values: {"score":<overall integer 0-100>,"scoreBreakdown":{"composition":<integer 0-100>,"lighting":<integer 0-100>,"color":<integer 0-100>,"sharpness":<integer 0-100>,"overall":<integer 0-100>},"summary":"brief score rationale"}',
      'Machine learning AI score',
    )
    return { ...parsed, model: modelName }
  }

  async critiquePhotoForAiAnalysis(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName = 'English',
  ) {
    const parsed = await this.requestPhotoJson<PhotoAiCritiqueResponse>(
      image,
      modelName,
      `Write a concise photography critique for this photo. Return strict JSON in ${languageName}. ` +
        'Be specific, practical, and objective. Mention what works well and the main improvement direction. ' +
        'Schema: {"evaluation":"overall critique","strengths":["strength 1","strength 2"]}',
      'Machine learning AI critique',
    )
    return {
      evaluation: parsed.evaluation || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      model: modelName,
    }
  }

  async suggestPhotoImprovements(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName = 'English',
  ) {
    const parsed = await this.requestPhotoJson<PhotoAiSuggestionsResponse>(
      image,
      modelName,
      `Suggest actionable ways to improve this photo. Return strict JSON in ${languageName}. ` +
        'Focus on changes a photographer can make when shooting or editing. Return 3 to 6 concise suggestions. ' +
        'Schema: {"suggestions":["suggestion 1","suggestion 2"]}',
      'Machine learning AI suggestions',
    )
    return {
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      model: modelName,
    }
  }

  async describeImage(
    image: Uint8Array | Buffer,
    modelName: string,
    languageName = 'English',
  ) {
    const response = await fetch(
      new URL('chat/completions', normalizeBaseUrl(this.getVlmBaseUrl())),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.getVlmHeaders(),
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    'Analyze this photo and return strict JSON. ' +
                    `Return all textual fields in ${languageName}. ` +
                    `The tags must use ${languageName}; keep proper nouns unchanged when appropriate. ` +
                    'Schema: {"caption":"short natural language description","description":"detailed visual description","evaluation":"brief photographic critique","tags":[{"tag":"short tag","score":0.0}]}',
                },
                {
                  type: 'image_url',
                  image_url: { url: imageToDataUrl(image) },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      },
    )

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '')
      throw new Error(
        `Machine learning image analysis failed: ${response.status}${
          responseBody ? ` ${truncateErrorBody(responseBody)}` : ''
        }`,
      )
    }

    const payload = (await response.json()) as ChatCompletionResponse
    const content = payload.choices?.[0]?.message?.content || ''
    return this.parseAnalyzeContent(content, modelName)
  }

  private parseAnalyzeContent(content: string, modelName: string) {
    try {
      const parsed = JSON.parse(extractJsonObject(content)) as AnalyzeResponse
      return {
        caption: parsed.caption || parsed.description || '',
        description: parsed.description || parsed.caption || '',
        evaluation: parsed.evaluation || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        model: modelName,
      }
    } catch {
      return {
        caption: content,
        description: content,
        evaluation: '',
        tags: [],
        model: modelName,
      }
    }
  }

  async embedImage(image: Uint8Array | Buffer, modelName: string) {
    const embeddingModel = assertJinaImageEmbeddingModel(modelName)
    const embedding = coerceEmbedding(
      await postJsonUrl(
        new URL('embeddings', normalizeBaseUrl(this.getEmbeddingBaseUrl())),
        {
          model: embeddingModel,
          input: [{ image: imageToBase64(image) }],
          normalized: true,
          embedding_type: 'float',
        },
        this.getEmbeddingHeaders(),
      ),
    )
    return embedding
  }

  async embedText(text: string, modelName: string) {
    if (!modelName.trim()) {
      throw new Error('Machine learning embedding model is not configured')
    }
    const embedding = coerceEmbedding(
      await postJsonUrl(
        new URL('embeddings', normalizeBaseUrl(this.getEmbeddingBaseUrl())),
        {
          model: modelName,
          input: [text],
          normalized: true,
          embedding_type: 'float',
        },
        this.getEmbeddingHeaders(),
      ),
    )
    return embedding
  }

  async testTextEmbedding(
    modelName = this.embeddingModel,
    text = 'LumaMemo semantic search probe',
  ) {
    const embedding = await this.embedText(text, modelName)
    if (embedding.length === 0) {
      throw new Error('Text embedding test returned an empty vector')
    }
    return { embeddingDim: embedding.length }
  }

  async testImageEmbedding(modelName = this.embeddingModel) {
    const embedding = await this.embedImage(
      createMachineLearningTestImage(),
      modelName,
    )
    if (embedding.length === 0) {
      throw new Error('Image embedding test returned an empty vector')
    }
    return { embeddingDim: embedding.length }
  }

  async probeImageEmbedding(modelName = this.embeddingModel) {
    const embeddingModel = assertJinaImageEmbeddingModel(modelName)
    const testImage = createMachineLearningTestImage()
    const response = await fetch(
      new URL('embeddings', normalizeBaseUrl(this.getEmbeddingBaseUrl())),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.getEmbeddingHeaders(),
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: [{ image: imageToBase64(testImage) }],
          normalized: true,
          embedding_type: 'float',
        }),
      },
    )
    return {
      ok: response.ok,
      status: response.status,
      body: await readResponseBody(response),
    }
  }

  async probeTextEmbedding(modelName = this.embeddingModel) {
    const response = await fetch(
      new URL('embeddings', normalizeBaseUrl(this.getEmbeddingBaseUrl())),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.getEmbeddingHeaders(),
        },
        body: JSON.stringify({
          model: modelName,
          input: ['LumaMemo semantic search probe'],
          normalized: true,
          embedding_type: 'float',
        }),
      },
    )
    return {
      ok: response.ok,
      status: response.status,
      body: await readResponseBody(response),
    }
  }

  async probeChatCompletion(modelName = this.vlmModel) {
    const response = await fetch(
      new URL('chat/completions', normalizeBaseUrl(this.getVlmBaseUrl())),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.getVlmHeaders(),
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'Return {} as JSON.' }],
          temperature: 0,
        }),
      },
    )
    return {
      ok: response.ok,
      status: response.status,
      body: await readResponseBody(response),
    }
  }

  async probeFaceModel(modelName: string) {
    const testImage = createMachineLearningTestImage()
    const response = await fetch(
      new URL('v1/face/analyze', normalizeBaseUrl(this.localAiBaseUrl)),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          img: imageBufferToDataUrl(testImage),
          actions: [],
          anti_spoofing: false,
        }),
      },
    )
    return {
      ok: response.ok,
      status: response.status,
      body: await readResponseBody(response),
    }
  }

  async detectFaces(image: Uint8Array | Buffer, modelName: string) {
    const detections = normalizeLocalAiFaceDetections(
      await postJson(this.localAiBaseUrl, 'v1/face/analyze', {
        model: modelName,
        img: imageToDataUrl(image),
        actions: [],
        anti_spoofing: false,
      }),
    )

    const faces: MachineLearningFace[] = []
    for (const detection of detections) {
      if (!detection.boundingBox) continue
      const crop = await cropFaceImage(image, detection.boundingBox)
      const embedding = normalizeLocalAiFaceEmbedding(
        await postJson(this.localAiBaseUrl, 'v1/face/embed', {
          model: modelName,
          img: imageBufferToDataUrl(crop),
        }),
      )
      faces.push({ ...detection, embedding })
    }

    return faces
  }
}

export const createMachineLearningClient = (
  settings: MachineLearningSettings,
) => new MachineLearningClient(settings)
