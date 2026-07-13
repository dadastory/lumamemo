import { createHash } from 'node:crypto'
import {
  getMachineLearningSettings,
  type MachineLearningSettings,
} from './client'
import { logger } from '~~/server/utils/logger'

const vectorStoreLogger = logger.dynamic('ml-vector-store')
const MAX_ERROR_BODY_LENGTH = 1200

type QdrantPoint = {
  id: string
  score?: number
  payload?: Record<string, any>
}

type QdrantResponse<T> = {
  result?: T
  status?: string
}

type VectorStoreSettings = Pick<
  MachineLearningSettings,
  | 'vectorProvider'
  | 'vectorBaseUrl'
  | 'vectorApiKey'
  | 'vectorCollectionPrefix'
  | 'embeddingModel'
  | 'faceModel'
>

export type PhotoEmbeddingPayload = {
  photoId: string
  ownerUserId?: number | null
  visibility?: string | null
  modelName: string
  embedding: number[]
}

export type FaceEmbeddingPayload = {
  faceId: number
  photoId: string
  ownerUserId?: number | null
  personId?: number | null
  boundingBox?: { x: number; y: number; width: number; height: number }
  score?: number | null
  cropStorageKey?: string | null
  cropWidth?: number | null
  cropHeight?: number | null
  cropSize?: number | null
  modelName: string
  embedding: number[]
}

export type FacePayload = Omit<FaceEmbeddingPayload, 'embedding'> & {
  embeddingDim?: number
  updatedAt?: string
}

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

const truncateErrorBody = (value: string) =>
  value.length > MAX_ERROR_BODY_LENGTH
    ? `${value.slice(0, MAX_ERROR_BODY_LENGTH)}...`
    : value

const sanitizeCollectionPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'default'

const hashPart = (value: string) =>
  createHash('sha1').update(value).digest('hex').slice(0, 12)

const stableUuid = (value: string) => {
  const hex = createHash('sha1').update(value).digest('hex').slice(0, 32)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

const assertEmbedding = (embedding: number[]) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Empty embedding returned from machine learning service')
  }
  if (!embedding.every((value) => Number.isFinite(value))) {
    throw new Error('Machine learning service returned an invalid embedding')
  }
}

const filterByPayload = (payload: Record<string, unknown>) => ({
  must: Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      match: Array.isArray(value) ? { any: value } : { value },
    })),
})

export class QdrantVectorStore {
  readonly settings: VectorStoreSettings

  constructor(settings: VectorStoreSettings) {
    this.settings = settings
  }

  private get headers() {
    return {
      'content-type': 'application/json',
      ...(this.settings.vectorApiKey
        ? { 'api-key': this.settings.vectorApiKey }
        : {}),
    }
  }

  private get prefix() {
    return sanitizeCollectionPart(
      this.settings.vectorCollectionPrefix || 'lumamemo',
    )
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: { allowNotFound?: boolean } = {},
  ) {
    const response = await fetch(
      new URL(path, normalizeBaseUrl(this.settings.vectorBaseUrl)),
      {
        ...init,
        headers: {
          ...this.headers,
          ...init.headers,
        },
      },
    )

    if (options.allowNotFound && response.status === 404) return null
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Qdrant request failed: ${path} ${response.status}${
          body ? ` ${truncateErrorBody(body)}` : ''
        }`,
      )
    }
    return (await response.json()) as QdrantResponse<T>
  }

  getPhotoCollection(modelName: string, embeddingDim: number) {
    return `${this.prefix}_photos_${hashPart(modelName)}_${embeddingDim}`
  }

  getFaceCollection(modelName: string, embeddingDim: number) {
    return `${this.prefix}_faces_${hashPart(modelName)}_${embeddingDim}`
  }

  async listCollections() {
    const payload = await this.request<{ collections?: Array<{ name: string }> }>(
      'collections',
    )
    return payload?.result?.collections?.map((collection) => collection.name) || []
  }

  async checkHealth() {
    try {
      const payload = await this.request<{ collections?: Array<{ name: string }> }>(
        'collections',
      )
      return {
        ok: true,
        status: null,
        body: {
          provider: this.settings.vectorProvider,
          collections: payload?.result?.collections?.length || 0,
        },
      }
    } catch (error) {
      return {
        ok: false,
        status: null,
        body: { error: (error as Error).message },
      }
    }
  }

  async ensureCollection(collection: string, embeddingDim: number) {
    const existing = await this.request(
      `collections/${encodeURIComponent(collection)}`,
      {},
      { allowNotFound: true },
    )
    if (existing) return

    await this.request(`collections/${encodeURIComponent(collection)}`, {
      method: 'PUT',
      body: JSON.stringify({
        vectors: {
          size: embeddingDim,
          distance: 'Cosine',
        },
      }),
    })
  }

  async upsertPhotoEmbedding(payload: PhotoEmbeddingPayload) {
    assertEmbedding(payload.embedding)
    const embeddingDim = payload.embedding.length
    const collection = this.getPhotoCollection(payload.modelName, embeddingDim)
    await this.ensureCollection(collection, embeddingDim)

    await this.request(`collections/${encodeURIComponent(collection)}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [
          {
            id: stableUuid(`photo:${payload.photoId}:${payload.modelName}:${embeddingDim}`),
            vector: payload.embedding,
            payload: {
              photoId: payload.photoId,
              ownerUserId: payload.ownerUserId ?? null,
              visibility: payload.visibility ?? null,
              modelName: payload.modelName,
              embeddingDim,
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      }),
    })
  }

  async searchPhotoEmbeddings(options: {
    embedding: number[]
    modelName: string
    ownerUserId?: number | null
    visibility?: string | null
    limit: number
    minScore?: number
  }) {
    assertEmbedding(options.embedding)
    const embeddingDim = options.embedding.length
    const collection = this.getPhotoCollection(options.modelName, embeddingDim)
    const existing = await this.request(
      `collections/${encodeURIComponent(collection)}`,
      {},
      { allowNotFound: true },
    )
    if (!existing) return []

    const payload = await this.request<QdrantPoint[]>(
      `collections/${encodeURIComponent(collection)}/points/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          vector: options.embedding,
          limit: options.limit,
          score_threshold: options.minScore,
          with_payload: true,
          filter: filterByPayload({
            modelName: options.modelName,
            ownerUserId: options.ownerUserId ?? undefined,
            visibility: options.visibility ?? undefined,
          }),
        }),
      },
    )

    return (payload?.result || []).map((point) => ({
      photoId: String(point.payload?.photoId || ''),
      score: Number(point.score || 0),
    })).filter((point) => point.photoId)
  }

  async getPhotoEmbeddingPresence(
    photoIds: string[],
    modelName: string,
    embeddingDim?: number,
  ) {
    if (photoIds.length === 0) return new Set<string>()
    const collections =
      embeddingDim && embeddingDim > 0
        ? [this.getPhotoCollection(modelName, embeddingDim)]
        : (await this.listCollections()).filter((collection) =>
            collection.startsWith(`${this.prefix}_photos_${hashPart(modelName)}_`),
          )

    const found = new Set<string>()
    for (const collection of collections) {
      const existing = await this.request(
        `collections/${encodeURIComponent(collection)}`,
        {},
        { allowNotFound: true },
      )
      if (!existing) continue

      const payload = await this.request<{ points?: QdrantPoint[] }>(
        `collections/${encodeURIComponent(collection)}/points/scroll`,
        {
          method: 'POST',
          body: JSON.stringify({
            limit: photoIds.length,
            with_payload: ['photoId'],
            with_vector: false,
            filter: filterByPayload({ modelName, photoId: photoIds }),
          }),
        },
      )

      ;(payload?.result?.points || [])
        .map((point) => String(point.payload?.photoId || ''))
        .filter(Boolean)
        .forEach((photoId) => found.add(photoId))
    }

    return found
  }

  async hasPhotoEmbedding(photoId: string, modelName: string, embeddingDim?: number) {
    return (await this.getPhotoEmbeddingPresence([photoId], modelName, embeddingDim)).has(photoId)
  }

  async deletePhotoEmbeddings(photoId: string) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_photos_`),
    )
    await Promise.all(
      collections.map((collection) =>
        this.request(`collections/${encodeURIComponent(collection)}/points/delete?wait=true`, {
          method: 'POST',
          body: JSON.stringify({
            filter: filterByPayload({ photoId }),
          }),
        }).catch((error) => {
          vectorStoreLogger.warn(
            `Failed to delete photo embedding for ${photoId} from ${collection}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }),
      ),
    )
  }

  async updatePhotoVisibility(photoId: string, visibility: string | null) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_photos_`),
    )
    await Promise.all(
      collections.map((collection) =>
        this.request(`collections/${encodeURIComponent(collection)}/points/payload?wait=true`, {
          method: 'POST',
          body: JSON.stringify({
            payload: {
              visibility,
              updatedAt: new Date().toISOString(),
            },
            filter: filterByPayload({ photoId }),
          }),
        }).catch((error) => {
          vectorStoreLogger.warn(
            `Failed to update photo visibility for ${photoId} in ${collection}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }),
      ),
    )
  }

  async upsertFaceEmbedding(payload: FaceEmbeddingPayload) {
    assertEmbedding(payload.embedding)
    const embeddingDim = payload.embedding.length
    const collection = this.getFaceCollection(payload.modelName, embeddingDim)
    await this.ensureCollection(collection, embeddingDim)

    await this.request(`collections/${encodeURIComponent(collection)}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: [
          {
            id: stableUuid(`face:${payload.faceId}:${payload.modelName}:${embeddingDim}`),
            vector: payload.embedding,
            payload: {
              faceId: payload.faceId,
              photoId: payload.photoId,
              ownerUserId: payload.ownerUserId ?? null,
              personId: payload.personId ?? null,
              boundingBox: payload.boundingBox ?? null,
              score: payload.score ?? null,
              cropStorageKey: payload.cropStorageKey ?? null,
              cropWidth: payload.cropWidth ?? null,
              cropHeight: payload.cropHeight ?? null,
              cropSize: payload.cropSize ?? null,
              modelName: payload.modelName,
              embeddingDim,
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      }),
    })
  }

  async searchFaceEmbeddings(options: {
    embedding: number[]
    modelName: string
    ownerUserId?: number | null
    limit: number
  }) {
    assertEmbedding(options.embedding)
    const embeddingDim = options.embedding.length
    const collection = this.getFaceCollection(options.modelName, embeddingDim)
    const existing = await this.request(
      `collections/${encodeURIComponent(collection)}`,
      {},
      { allowNotFound: true },
    )
    if (!existing) return []

    const payload = await this.request<QdrantPoint[]>(
      `collections/${encodeURIComponent(collection)}/points/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          vector: options.embedding,
          limit: options.limit,
          with_payload: true,
          filter: filterByPayload({
            modelName: options.modelName,
            ownerUserId: options.ownerUserId ?? undefined,
          }),
        }),
      },
    )

    return (payload?.result || []).map((point) => ({
      faceId: Number(point.payload?.faceId || 0),
      photoId: String(point.payload?.photoId || ''),
      personId:
        point.payload?.personId === null || point.payload?.personId === undefined
          ? null
          : Number(point.payload.personId),
      score: Number(point.score || 0),
    })).filter((point) => point.faceId)
  }

  private normalizeFacePayload(payload: Record<string, any> | undefined) {
    if (!payload) return null
    const faceId = Number(payload.faceId || 0)
    if (!faceId) return null

    return {
      faceId,
      photoId: String(payload.photoId || ''),
      ownerUserId:
        payload.ownerUserId === null || payload.ownerUserId === undefined
          ? null
          : Number(payload.ownerUserId),
      personId:
        payload.personId === null || payload.personId === undefined
          ? null
          : Number(payload.personId),
      boundingBox: payload.boundingBox || null,
      score:
        payload.score === null || payload.score === undefined
          ? null
          : Number(payload.score),
      cropStorageKey: payload.cropStorageKey || null,
      cropWidth:
        payload.cropWidth === null || payload.cropWidth === undefined
          ? null
          : Number(payload.cropWidth),
      cropHeight:
        payload.cropHeight === null || payload.cropHeight === undefined
          ? null
          : Number(payload.cropHeight),
      cropSize:
        payload.cropSize === null || payload.cropSize === undefined
          ? null
          : Number(payload.cropSize),
      modelName: String(payload.modelName || ''),
      embeddingDim:
        payload.embeddingDim === null || payload.embeddingDim === undefined
          ? undefined
          : Number(payload.embeddingDim),
      updatedAt: payload.updatedAt ? String(payload.updatedAt) : undefined,
    } satisfies FacePayload
  }

  async listFacePayloads(options: {
    ownerUserId?: number | null
    modelName?: string
    photoIds?: string[]
    personId?: number | null
    cropStorageKey?: string | null
    includeUnassigned?: boolean
  } = {}) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_faces_`),
    )
    const results: FacePayload[] = []

    for (const collection of collections) {
      let offset: unknown = undefined
      do {
        const payload = await this.request<{
          points?: QdrantPoint[]
          next_page_offset?: unknown
        }>(`collections/${encodeURIComponent(collection)}/points/scroll`, {
          method: 'POST',
          body: JSON.stringify({
            limit: 256,
            offset,
            with_payload: true,
            with_vector: false,
            filter: filterByPayload({
              ownerUserId: options.ownerUserId ?? undefined,
              modelName: options.modelName ?? undefined,
              photoId: options.photoIds?.length ? options.photoIds : undefined,
              cropStorageKey: options.cropStorageKey ?? undefined,
              ...(options.includeUnassigned
                ? {}
                : { personId: options.personId ?? undefined }),
            }),
          }),
        })

        for (const point of payload?.result?.points || []) {
          const face = this.normalizeFacePayload(point.payload)
          if (face) results.push(face)
        }
        offset = payload?.result?.next_page_offset
      } while (offset)
    }

    return results
  }

  async countFacePayloads(options: {
    ownerUserId?: number | null
    modelName?: string
    photoIds?: string[]
    personId?: number | null
    cropStorageKey?: string | null
    includeUnassigned?: boolean
  } = {}) {
    return (await this.listFacePayloads(options)).length
  }

  async getFacePayload(faceId: number) {
    const faces = await this.listFacePayloads({ includeUnassigned: true })
    return faces.find((face) => face.faceId === faceId) || null
  }

  async listFaceEmbeddings(ownerUserId?: number | null, modelName?: string) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_faces_`),
    )
    const results: Array<FacePayload & { embedding: number[] }> = []

    for (const collection of collections) {
      let offset: unknown = undefined
      do {
        const payload = await this.request<{
          points?: Array<QdrantPoint & { vector?: number[] }>
          next_page_offset?: unknown
        }>(`collections/${encodeURIComponent(collection)}/points/scroll`, {
          method: 'POST',
          body: JSON.stringify({
            limit: 256,
            offset,
            with_payload: true,
            with_vector: true,
            filter: filterByPayload({
              ownerUserId: ownerUserId ?? undefined,
              modelName: modelName ?? undefined,
            }),
          }),
        })

        for (const point of payload?.result?.points || []) {
          if (!Array.isArray(point.vector)) continue
          const faceId = Number(point.payload?.faceId || 0)
          if (!faceId) continue
          const facePayload = this.normalizeFacePayload(point.payload)
          if (!facePayload) continue
          results.push({
            ...facePayload,
            embedding: point.vector.map(Number),
          })
        }
        offset = payload?.result?.next_page_offset
      } while (offset)
    }

    return results
  }

  async setFacePersonId(faceId: number, personId: number | null) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_faces_`),
    )
    await Promise.all(
      collections.map((collection) =>
        this.request(`collections/${encodeURIComponent(collection)}/points/payload?wait=true`, {
          method: 'POST',
          body: JSON.stringify({
            payload: { personId },
            filter: filterByPayload({ faceId }),
          }),
        }).catch((error) => {
          vectorStoreLogger.warn(
            `Failed to set person ${personId ?? 'null'} for face ${faceId} in ${collection}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }),
      ),
    )
  }

  async setFacePersonIdByPerson(sourcePersonId: number, targetPersonId: number | null) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_faces_`),
    )
    await Promise.all(
      collections.map((collection) =>
        this.request(`collections/${encodeURIComponent(collection)}/points/payload?wait=true`, {
          method: 'POST',
          body: JSON.stringify({
            payload: { personId: targetPersonId },
            filter: filterByPayload({ personId: sourcePersonId }),
          }),
        }).catch((error) => {
          vectorStoreLogger.warn(
            `Failed to move faces from person ${sourcePersonId} to ${targetPersonId ?? 'null'} in ${collection}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }),
      ),
    )
  }

  async deleteFaceEmbeddingsForPhoto(photoId: string) {
    const collections = (await this.listCollections()).filter((collection) =>
      collection.startsWith(`${this.prefix}_faces_`),
    )
    await Promise.all(
      collections.map((collection) =>
        this.request(`collections/${encodeURIComponent(collection)}/points/delete?wait=true`, {
          method: 'POST',
          body: JSON.stringify({
            filter: filterByPayload({ photoId }),
          }),
        }).catch((error) => {
          vectorStoreLogger.warn(
            `Failed to delete face embeddings for ${photoId} from ${collection}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }),
      ),
    )
  }
}

export const createVectorStore = (settings: VectorStoreSettings) =>
  new QdrantVectorStore(settings)

export const getVectorStore = async () =>
  createVectorStore(await getMachineLearningSettings())

export const checkMachineLearningVectorStore = async () =>
  (await getVectorStore()).checkHealth()
