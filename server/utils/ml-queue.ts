import { assertMachineLearningEnabled } from './ml-capabilities'

const MACHINE_LEARNING_QUEUE_PAYLOAD_TYPES = new Set([
  'photo-ml-index',
  'photo-ml-auto-tags',
  'photo-ml-semantic-embedding',
  'photo-ai-analysis',
  'photo-face-detect',
  'photo-ml-backfill',
  'photo-face-cluster',
])

export const isMachineLearningQueuePayload = (payload: { type?: string }) =>
  MACHINE_LEARNING_QUEUE_PAYLOAD_TYPES.has(String(payload.type))

export const assertMachineLearningQueuePayloadEnabled = async (payload: {
  type?: string
}) => {
  if (!isMachineLearningQueuePayload(payload)) return
  await assertMachineLearningEnabled('Machine learning is disabled')
}
