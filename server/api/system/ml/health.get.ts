import {
  createMachineLearningClient,
  getMachineLearningSettings,
} from '~~/server/services/ml/client'
import { createVectorStore } from '~~/server/services/ml/vector-store'
import {
  assertMachineLearningAvailable,
  assertMachineLearningEnabled,
} from '~~/server/utils/ml-capabilities'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  await assertMachineLearningEnabled()
  await assertMachineLearningAvailable()

  const settings = await getMachineLearningSettings()
  const client = createMachineLearningClient(settings)
  const vectorStore = createVectorStore(settings)
  const [health, vector] = await Promise.all([
    client.checkHealth(),
    vectorStore.checkHealth(),
  ])
  const vlmReady = !settings.vlmModel || health.vlm.ok
  const embeddingReady = !settings.embeddingModel || health.embedding.ok
  const faceReady = !settings.faceModel || health.face.ok

  return {
    success: vector.ok && vlmReady && embeddingReady && faceReady,
    vlmProvider: settings.vlmProvider,
    vectorProvider: settings.vectorProvider,
    vlmBaseUrl: settings.vlmBaseUrl,
    embeddingBaseUrl: settings.embeddingBaseUrl,
    localAiBaseUrl: settings.localAiBaseUrl,
    vectorBaseUrl: settings.vectorBaseUrl,
    vlmModel: settings.vlmModel,
    embeddingModel: settings.embeddingModel,
    faceModel: settings.faceModel,
    embeddingProbe: health.embeddingProbe,
    faceProbe: health.faceProbe,
    vlmProbe: health.vlmProbe,
    health: { ...health, vector },
  }
})
