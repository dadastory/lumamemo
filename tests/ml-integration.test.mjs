import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const readFirstExistingSource = (...paths) => {
  for (const path of paths) {
    const url = new URL(`../${path}`, import.meta.url)
    if (existsSync(url)) return readFileSync(url, 'utf8')
  }
  throw new Error(`None of these files exist: ${paths.join(', ')}`)
}

describe('machine learning integration', () => {
  it('uses Jina image embeddings, LocalAI face, and optional VLM models without Ollama, Infinity, or aesthetic scoring', () => {
    const middlewareCompose = readSource(
      'third-party/middleware/docker-compose.yml',
    )
    const aiCompose = readSource('third-party/ai/docker-compose.yml')
    const env = readSource('.env.example')
    const client = readSource('server/services/ml/client.ts')
    const settingsConstants = readSource('server/services/settings/contants.ts')
    const settingsUi = readSource('server/services/settings/ui-config.ts')
    const qwenServicePath = new URL(
      '../third-party/ai/qwen-service',
      import.meta.url,
    )
    const faceServicePath = new URL(
      '../third-party/ai/face-service',
      import.meta.url,
    )

    assert.doesNotMatch(middlewareCompose, /immich-machine-learning/)
    assert.doesNotMatch(env, /IMMICH_ML/)
    assert.match(env, /ML_LOCALAI_BASE_URL=http:\/\/lumamemo-localai:8080/)
    assert.doesNotMatch(env, /ML_LOCALAI_MODELS_PATH/)
    assert.match(env, /ML_VLM_PROVIDER=openai-compatible/)
    assert.match(env, /ML_VLM_BASE_URL=/)
    assert.match(env, /ML_VLM_API_KEY=/)
    assert.doesNotMatch(env, /ML_EMBEDDING_PROVIDER/)
    assert.match(env, /ML_EMBEDDING_BASE_URL=https:\/\/api\.jina\.ai\/v1/)
    assert.match(env, /ML_EMBEDDING_API_KEY=/)
    assert.match(env, /ML_EMBEDDING_MODEL=/)
    assert.doesNotMatch(env, /ML_OLLAMA/)
    assert.doesNotMatch(env, /ML_INFINITY_/)
    assert.doesNotMatch(env, /ML_CLIP_MODEL/)
    assert.doesNotMatch(env, /INFINITY_IMAGE/)
    assert.doesNotMatch(env, /INFINITY_MODEL_ID/)
    assert.doesNotMatch(env, /ML_AESTHETIC_MODEL/)
    assert.match(env, /ML_VECTOR_PROVIDER=qdrant/)
    assert.match(env, /ML_VECTOR_BASE_URL=http:\/\/lumamemo-qdrant:6333/)
    assert.match(env, /ML_VECTOR_API_KEY=/)
    assert.match(env, /ML_VECTOR_COLLECTION_PREFIX=lumamemo/)
    assert.match(env, /ML_FACE_MODEL=/)
    assert.match(
      env,
      /LOCALAI_IMAGE=localai\/localai:v4\.6\.0-gpu-nvidia-cuda-12/,
    )
    assert.doesNotMatch(env, /LOCALAI_CPU_IMAGE/)
    assert.match(env, /LOCALAI_PORT=18080/)
    assert.match(env, /LOCALAI_DEBUG=false/)
    assert.match(env, /LOCALAI_DISABLE_HARDWARE_DEFAULTS=true/)
    assert.match(env, /QDRANT_IMAGE=qdrant\/qdrant:v1\.18\.2/)
    assert.doesNotMatch(env, /FACE_AI_IMAGE/)
    assert.doesNotMatch(env, /FACE_ENABLE_MODEL_LOAD/)
    assert.doesNotMatch(env, /INSIGHTFACE_HOME/)
    assert.doesNotMatch(env, /QWEN_AI_IMAGE/)
    assert.doesNotMatch(env, /QWEN_ENABLE_MODEL_LOAD/)
    assert.doesNotMatch(env, /ML_DEVICE_MODE/)
    assert.doesNotMatch(env, /lumamemo-qwen-ai/)
    assert.doesNotMatch(env, /Qwen\/Qwen3-VL/)

    assert.doesNotMatch(aiCompose, /lumamemo-qwen-ai:/)
    assert.doesNotMatch(aiCompose, /qwen-service/)
    assert.doesNotMatch(aiCompose, /QWEN_ENABLE_MODEL_LOAD/)
    assert.match(aiCompose, /lumamemo-localai:/)
    assert.match(aiCompose, /localai\/localai/)
    assert.match(aiCompose, /v4\.6\.0-gpu-nvidia-cuda-12/)
    assert.match(aiCompose, /['"]\$\{LOCALAI_PORT:-18080\}:8080['"]/)
    assert.match(aiCompose, /DEBUG: \$\{LOCALAI_DEBUG:-false\}/)
    assert.match(
      aiCompose,
      /LOCALAI_DISABLE_HARDWARE_DEFAULTS: \$\{LOCALAI_DISABLE_HARDWARE_DEFAULTS:-true\}/,
    )
    assert.match(aiCompose, /GALLERIES:/)
    assert.match(
      aiCompose,
      /github:mudler\/LocalAI\/gallery\/index\.yaml@master/,
    )
    assert.doesNotMatch(aiCompose, /lumamemo-gallery/)
    assert.match(aiCompose, /driver:\s*nvidia/)
    assert.match(aiCompose, /capabilities:[\s\S]*gpu/)
    assert.match(aiCompose, /lumamemo-qdrant:/)
    assert.doesNotMatch(aiCompose, /lumamemo-infinity:/)
    assert.doesNotMatch(aiCompose, /michaelf34\/infinity/)
    assert.doesNotMatch(aiCompose, /INFINITY_MODEL_ID/)
    assert.doesNotMatch(aiCompose, /wkcn\/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M/)
    assert.doesNotMatch(aiCompose, /jinaai\/jina-clip-v1/)
    assert.doesNotMatch(aiCompose, /google\/siglip-so400m-patch14-384/)
    assert.doesNotMatch(aiCompose, /data\/ai\/infinity\/cache/)
    assert.match(aiCompose, /qdrant\/qdrant:v1\.18\.2/)
    assert.match(aiCompose, /data\/ai\/qdrant/)
    assert.match(aiCompose, /data\/ai\/localai\/models/)
    assert.match(aiCompose, /data\/ai\/localai\/backend_data/)
    assert.match(aiCompose, /LOCALAI_BACKENDS_PATH: \/tmp\/localai\/backends/)
    assert.match(aiCompose, /data\/ai\/localai\/cache/)
    assert.doesNotMatch(
      aiCompose,
      /third-party\/ai\/localai-gallery:\/models\/lumamemo-gallery:ro/,
    )
    assert.doesNotMatch(aiCompose, /third-party\/ai\/data/)
    assert.doesNotMatch(aiCompose, /profiles:[\s\S]*gpu/)
    assert.doesNotMatch(aiCompose, /vllm/i)
    assert.doesNotMatch(aiCompose, /ML_INFINITY_/)
    assert.doesNotMatch(aiCompose, /build:[\s\S]*face-service/)
    assert.doesNotMatch(aiCompose, /lumamemo-face-ai/)
    assert.match(client, /chat\/completions/)
    assert.doesNotMatch(client, /ollama/i)
    assert.doesNotMatch(client, /new URL\('api\/chat'/)
    assert.doesNotMatch(client, /new URL\('api\/embed'/)
    assert.match(client, /embedImage/)
    assert.match(client, /embedText/)
    assert.doesNotMatch(client, /infinityBaseUrl/)
    assert.match(client, /new URL\('embeddings'/)
    assert.match(client, /embedding_type: 'float'/)
    assert.match(client, /normalized: true/)
    assert.match(client, /image: imageToBase64\(image\)/)
    assert.match(client, /TEST_FACE_IMAGE_SOURCE/)
    assert.match(client, /TEST_FACE_IMAGE_BASE64/)
    assert.match(client, /createMachineLearningTestImageMetadata/)
    assert.doesNotMatch(client, /const TEST_JPEG_BASE64/)
    assert.doesNotMatch(client, /image: imageToBase64\(onePixelJpeg\)/)
    assert.match(client, /image: imageToBase64\(testImage\)/)
    assert.match(client, /image_url: \{ url: imageToDataUrl\(image\) \}/)
    assert.match(client, /img: imageToDataUrl\(image\)/)
    assert.doesNotMatch(client, /image: imageToDataUrl\(image\)/)
    assert.match(client, /getEmbeddingBaseUrl/)
    assert.match(client, /getEmbeddingHeaders/)
    assert.match(client, /probeImageEmbedding/)
    assert.doesNotMatch(client, /v1\/clip\/embed/)
    assert.doesNotMatch(client, /scoreAesthetic/)
    assert.doesNotMatch(client, /v1\/aesthetic\/score/)
    assert.match(client, /describeImage/)
    assert.doesNotMatch(client, /local-qwen/)
    assert.doesNotMatch(client, /v1\/image\/analyze/)
    assert.match(client, /v1\/face\/analyze/)
    assert.doesNotMatch(client, /v1\/face\/detect/)
    assert.match(client, /v1\/face\/embed/)
    assert.match(client, /FACE_EMBEDDING_CROP_PADDING/)
    assert.match(client, /normalizeLocalAiFaceDetections/)
    assert.match(client, /normalizeLocalAiFaceEmbedding/)
    assert.match(
      settingsConstants,
      /enum: \['openai', 'openai-compatible', 'localai'\]/,
    )
    assert.match(
      settingsConstants,
      /defaultValue: process\.env\.ML_FACE_MODEL \|\| ''/,
    )
    assert.match(settingsConstants, /key: 'ml\.localAiBaseUrl'/)
    assert.doesNotMatch(settingsConstants, /key: 'ml\.localAiModelStatus'/)
    assert.doesNotMatch(settingsConstants, /key: 'ml\.embeddingProvider'/)
    assert.match(settingsConstants, /key: 'ml\.embeddingBaseUrl'/)
    assert.match(settingsConstants, /key: 'ml\.embeddingApiKey'/)
    assert.match(settingsConstants, /key: 'ml\.embeddingModel'/)
    assert.match(settingsConstants, /https:\/\/api\.jina\.ai\/v1/)
    assert.doesNotMatch(settingsConstants, /key: 'ml\.infinityBaseUrl'/)
    assert.doesNotMatch(settingsConstants, /key: 'ml\.infinityApiKey'/)
    assert.doesNotMatch(settingsConstants, /key: 'ml\.clipModel'/)
    assert.doesNotMatch(settingsConstants, /ml\.aestheticScore/)
    assert.doesNotMatch(settingsConstants, /ml\.aestheticModel/)
    assert.doesNotMatch(settingsConstants, /ml\.clipModel/)
    assert.match(settingsUi, /'ml\.faceModel': \{[\s\S]*type: 'input'/)
    assert.doesNotMatch(settingsUi, /'ml\.embeddingProvider'/)
    assert.match(settingsUi, /'ml\.embeddingBaseUrl': \{[\s\S]*type: 'url'/)
    assert.match(settingsUi, /'ml\.embeddingApiKey': \{[\s\S]*type: 'password'/)
    assert.match(
      settingsUi,
      /'ml\.embeddingModel': \{[\s\S]*type: 'input'[\s\S]*required: true/,
    )
    assert.match(settingsUi, /jina-embeddings-v5-omni-small/)
    assert.doesNotMatch(settingsUi, /jina-clip-v1/)
    assert.doesNotMatch(settingsUi, /jina-clip-v2/)
    assert.doesNotMatch(settingsUi, /jina-embeddings-v4/)
    assert.doesNotMatch(settingsUi, /'ml\.aestheticModel'/)
    assert.match(settingsUi, /'ml\.vlmModel': \{[\s\S]*type: 'input'/)
    assert.match(settingsUi, /'ml\.vlmProvider': \{[\s\S]*value: 'localai'/)
    assert.doesNotMatch(
      settingsUi,
      /'ml\.vlmProvider': \{[\s\S]*value: 'ollama'/,
    )
    assert.doesNotMatch(settingsUi, /asyncOptions: \{ type: 'localai-models'/)
    assert.doesNotMatch(settingsUi, /value: 'insightface-buffalo-l'/)
    assert.doesNotMatch(settingsUi, /value: 'insightface-antelopev2'/)
    assert.doesNotMatch(settingsUi, /wkcn\/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M/)
    assert.doesNotMatch(settingsUi, /jinaai\/jina-clip-v1/)
    assert.doesNotMatch(settingsUi, /google\/siglip-so400m-patch14-384/)
    assert.doesNotMatch(settingsUi, /value: 'qwen3-vl-embedding-2b'/)
    assert.doesNotMatch(settingsUi, /laion-aesthetic/)
    assert.doesNotMatch(settingsUi, /value: 'gpt-4o-mini'/)
    assert.doesNotMatch(settingsUi, /infinity-clip-models/)
    assert.doesNotMatch(settingsUi, /value: 'insightface-opencv'/)
    assert.equal(existsSync(qwenServicePath), false)
    assert.equal(existsSync(faceServicePath), false)
    assert.equal(
      existsSync(new URL('../third-party/ai/scripts', import.meta.url)),
      false,
    )
  })

  it('keeps vector data out of PostgreSQL ML schema and migrations', () => {
    const postgresMigration = readSource(
      'server/database/migrations/postgres/0000_initial.sql',
    )
    const sqliteMigration = readSource(
      'server/database/migrations/0000_initial.sql',
    )
    const postgresMigrationFiles = readdirSync(
      new URL('../server/database/migrations/postgres', import.meta.url),
    ).filter((file) => file.endsWith('.sql'))
    const sqliteMigrationFiles = readdirSync(
      new URL('../server/database/migrations', import.meta.url),
    ).filter((file) => file.endsWith('.sql'))
    const sqliteSchema = readSource('server/database/schema.ts')
    const postgresSchema = readSource('server/database/schema/postgres.ts')
    const capability = readSource('server/utils/ml-capabilities.ts')

    assert.deepEqual(postgresMigrationFiles, ['0000_initial.sql'])
    assert.deepEqual(sqliteMigrationFiles, ['0000_initial.sql'])
    for (const migration of [postgresMigration, sqliteMigration]) {
      assert.match(migration, /CREATE TABLE .*photos/)
      assert.doesNotMatch(migration, /ai_description/)
      assert.doesNotMatch(migration, /aesthetic_score/)
      assert.doesNotMatch(migration, /aesthetic_model/)
      assert.doesNotMatch(migration, /aesthetic_scored_at/)
      assert.match(migration, /CREATE TABLE .*people/)
    }
    assert.doesNotMatch(
      postgresMigration,
      /CREATE EXTENSION IF NOT EXISTS vector/,
    )
    assert.doesNotMatch(postgresMigration, /embedding vector/)
    assert.doesNotMatch(postgresMigration, /photo_embeddings/)
    assert.doesNotMatch(postgresMigration, /face_embeddings/)
    assert.doesNotMatch(postgresSchema, /customType/)
    assert.doesNotMatch(postgresSchema, /photoEmbeddings/)
    assert.doesNotMatch(postgresSchema, /faceEmbeddings/)
    assert.doesNotMatch(sqliteSchema, /aiDescription/)
    assert.doesNotMatch(postgresSchema, /aiDescription/)
    assert.match(postgresSchema, /people/)
    assert.doesNotMatch(postgresSchema, /photoAutoTags/)
    assert.doesNotMatch(postgresSchema, /photoFaces/)
    assert.doesNotMatch(postgresMigration, /DROP TABLE IF EXISTS photo_faces/)
    assert.doesNotMatch(
      postgresMigration,
      /DROP TABLE IF EXISTS photo_auto_tags/,
    )
    assert.doesNotMatch(
      postgresMigration,
      /CREATE TABLE IF NOT EXISTS photo_faces/,
    )
    assert.doesNotMatch(
      postgresMigration,
      /CREATE TABLE IF NOT EXISTS photo_auto_tags/,
    )
    assert.doesNotMatch(postgresSchema, /cropStorageKey/)
    assert.doesNotMatch(postgresSchema, /qualityScore/)
    assert.doesNotMatch(sqliteSchema, /photoEmbeddings/)
    assert.match(capability, /getDatabaseProvider\(\) !== 'postgres'/)
    assert.match(capability, /checkMachineLearningVectorStore/)
    assert.doesNotMatch(capability, /pg_extension/)
  })

  it('stores Jina multimodal semantic and LocalAI face embeddings in Qdrant without generic text embeddings', () => {
    const client = readSource('server/services/ml/client.ts')
    const vectorStore = readSource('server/services/ml/vector-store.ts')
    const uiConfig = readSource('server/services/settings/ui-config.ts')
    const adminSearch = readSource('server/api/photos/search/semantic.get.ts')
    const publicSearch = readSource(
      'server/api/public/profiles/[publicId]/photos/search/semantic.get.ts',
    )
    const indexer = readSource('server/services/ml/photo-indexer.ts')

    assert.doesNotMatch(client, /infinityBaseUrl/)
    assert.match(client, /new URL\('embeddings'/)
    assert.match(client, /image: imageToBase64\(image\)/)
    assert.match(client, /image: imageToBase64\(testImage\)/)
    assert.doesNotMatch(client, /image: imageToBase64\(onePixelJpeg\)/)
    assert.doesNotMatch(client, /image: imageToDataUrl\(image\)/)
    assert.match(client, /normalized: true/)
    assert.match(client, /embedding_type: 'float'/)
    assert.doesNotMatch(client, /modality: 'image'/)
    assert.doesNotMatch(client, /modality: 'text'/)
    assert.match(client, /probeImageEmbedding/)
    assert.doesNotMatch(client, /v1\/clip\/embed/)
    assert.doesNotMatch(uiConfig, /embeddingDimensions/)
    assert.match(vectorStore, /QdrantVectorStore/)
    assert.match(vectorStore, /ensureCollection/)
    assert.match(vectorStore, /upsertPhotoEmbedding/)
    assert.match(vectorStore, /searchPhotoEmbeddings/)
    assert.match(vectorStore, /upsertFaceEmbedding/)
    assert.match(vectorStore, /listFacePayloads/)
    assert.match(vectorStore, /countFacePayloads/)
    assert.match(vectorStore, /searchFaceEmbeddings/)
    assert.match(vectorStore, /embeddingDim/)
    assert.match(adminSearch, /searchPhotoEmbeddings/)
    assert.match(publicSearch, /searchPhotoEmbeddings/)
    assert.match(adminSearch, /settings\.embeddingModel/)
    assert.match(publicSearch, /settings\.embeddingModel/)
    assert.match(indexer, /upsertPhotoEmbedding/)
    assert.match(indexer, /upsertFaceEmbedding/)
    assert.match(indexer, /indexPhotoSemanticEmbedding/)
    assert.doesNotMatch(indexer, /indexPhotoSemanticClip/)
  })

  it('cleans stale ML vectors and face crops before replacing extracted data', () => {
    const indexer = readSource('server/services/ml/photo-indexer.ts')
    const photoDelete = readSource(
      'server/api/photos/[photoId]/index.delete.ts',
    )
    const userDelete = readSource('server/api/users/[userId].delete.ts')

    assert.match(
      indexer,
      /deletePhotoEmbeddings\(photo\.id\)[\s\S]*upsertPhotoEmbedding/,
    )
    assert.match(indexer, /cleanupGeneratedFaceCrops/)
    assert.match(indexer, /deleteExistingFaceDataForPhoto/)
    assert.match(
      indexer,
      /pendingFaces[\s\S]*deleteExistingFaceDataForPhoto[\s\S]*upsertFaceEmbedding/,
    )
    assert.match(
      indexer,
      /indexedFaces[\s\S]*upsertFaceEmbedding[\s\S]*indexedFaces\.push/,
    )
    assert.match(
      indexer,
      /catch \(error\)[\s\S]*cleanupGeneratedFaceCrops\(pendingFaces\)[\s\S]*deleteFaceEmbeddingsForPhoto\(photo\.id\)/,
    )
    assert.doesNotMatch(
      indexer,
      /const faces = await client\.detectFaces[\s\S]{0,600}deleteFaceEmbeddingsForPhoto/,
    )

    assert.match(photoDelete, /listFacePayloads/)
    assert.match(photoDelete, /deleteFaceEmbeddingsForPhoto/)
    assert.match(userDelete, /listFacePayloads/)
    assert.match(userDelete, /photoFacesByPhotoId/)
    assert.match(userDelete, /deleteFaceEmbeddingsForPhoto/)
    assert.match(userDelete, /delete\(postgresPeople\)[\s\S]*ownerUserId/)
    assert.match(userDelete, /deleted:[\s\S]*people/)
  })

  it('provides a unified ML cleanup endpoint for admin maintenance', () => {
    const cleanupApi = readSource('server/api/system/ml/cleanup.post.ts')
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const maintenancePage = readSource('app/pages/dashboard/maintenance.vue')
    const dashboardLayout = readSource('app/layouts/dashboard.vue')

    assert.match(cleanupApi, /requireAdminSession/)
    assert.match(cleanupApi, /scope:[\s\S]*photo[\s\S]*user[\s\S]*all/)
    assert.match(cleanupApi, /deletePhotoEmbeddings/)
    assert.match(cleanupApi, /deleteFaceEmbeddingsForPhoto/)
    assert.match(cleanupApi, /listFacePayloads/)
    assert.match(cleanupApi, /cropStorageKey/)
    assert.match(cleanupApi, /storageProvider\.delete/)
    assert.match(cleanupApi, /delete\(postgresPeople\)/)
    assert.match(cleanupApi, /pipelineQueue/)
    assert.doesNotMatch(aiSettings, /cleanupMachineLearningData/)
    assert.doesNotMatch(aiSettings, /settings\.system\.mlCleanup/)
    assert.doesNotMatch(aiSettings, /mlActionLoading === 'cleanup'/)
    assert.match(maintenancePage, /\/api\/system\/ml\/cleanup/)
    assert.match(maintenancePage, /DELETE AI DATA/)
    assert.match(maintenancePage, /scope: 'all'/)
    assert.match(maintenancePage, /scope: 'user'/)
    assert.match(maintenancePage, /scope: 'photo'/)
    assert.match(maintenancePage, /includeEditedPeople: false/)
    assert.match(maintenancePage, /includeQueueTasks: true/)
    assert.match(dashboardLayout, /title\.dataMaintenance/)
    assert.match(dashboardLayout, /\/dashboard\/maintenance/)
  })

  it('exposes ML system settings and blocks enabling ML on unsupported databases', () => {
    const constants = readSource('server/services/settings/contants.ts')
    const uiConfig = readSource('server/services/settings/ui-config.ts')
    const systemSettings = readSource('app/pages/dashboard/settings/system.vue')
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const singleSettingApi = readSource(
      'server/api/system/settings/[namespace]/[key].ts',
    )
    const batchSettingApi = readSource(
      'server/api/system/settings/batch.put.ts',
    )

    for (const key of [
      'ml.enabled',
      'ml.vlmProvider',
      'ml.vlmBaseUrl',
      'ml.vlmApiKey',
      'ml.vlmModel',
      'ml.localAiBaseUrl',
      'ml.embeddingBaseUrl',
      'ml.embeddingApiKey',
      'ml.embeddingModel',
      'ml.vectorProvider',
      'ml.vectorBaseUrl',
      'ml.vectorApiKey',
      'ml.vectorCollectionPrefix',
      'ml.localAiBaseUrl',
      'ml.faceModel',
      'ml.autoTag.enabled',
      'ml.autoTag.minScore',
      'ml.aiDescription.enabled',
      'ml.semanticSearch.enabled',
      'ml.faceAlbum.enabled',
      'ml.faceCluster.threshold',
      'ml.ocr.enabled',
    ]) {
      assert.match(
        constants,
        new RegExp(`key: '${key.replaceAll('.', '\\.')}'`),
      )
      assert.match(uiConfig, new RegExp(`'${key.replaceAll('.', '\\.')}'`))
      assert.match(aiSettings, new RegExp(`'${key.replaceAll('.', '\\.')}'`))
    }
    assert.doesNotMatch(systemSettings, /id: 'machineLearning'/)
    assert.doesNotMatch(systemSettings, /'ml\.enabled'/)
    assert.doesNotMatch(constants, /ml\.aestheticScore/)
    assert.doesNotMatch(constants, /ml\.aestheticModel/)
    assert.doesNotMatch(constants, /ml\.infinityBaseUrl/)
    assert.doesNotMatch(constants, /ml\.infinityApiKey/)
    assert.doesNotMatch(constants, /ml\.clipModel/)
    assert.doesNotMatch(constants, /ml\.embeddingProvider/)
    assert.doesNotMatch(uiConfig, /ml\.aestheticScore/)
    assert.doesNotMatch(uiConfig, /ml\.aestheticModel/)
    assert.doesNotMatch(uiConfig, /ml\.infinityBaseUrl/)
    assert.doesNotMatch(uiConfig, /ml\.infinityApiKey/)
    assert.doesNotMatch(uiConfig, /ml\.clipModel/)
    assert.doesNotMatch(uiConfig, /ml\.embeddingProvider/)
    assert.doesNotMatch(systemSettings, /ml\.aestheticScore/)
    assert.doesNotMatch(systemSettings, /ml\.aestheticModel/)
    assert.doesNotMatch(systemSettings, /ml\.infinityBaseUrl/)
    assert.doesNotMatch(systemSettings, /ml\.infinityApiKey/)
    assert.doesNotMatch(systemSettings, /ml\.clipModel/)
    assert.doesNotMatch(aiSettings, /ml\.embeddingProvider/)

    assert.match(singleSettingApi, /assertMachineLearningCanBeEnabled/)
    assert.match(batchSettingApi, /assertMachineLearningCanBeEnabled/)
  })

  it('keeps AI, third-party login, and system settings on separate settings pages', () => {
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const systemSettings = readSource('app/pages/dashboard/settings/system.vue')
    const loginSettings = readSource('app/pages/dashboard/settings/login.vue')
    const dashboardLayout = readSource('app/layouts/dashboard.vue')
    const zhHans = readSource('i18n/locales/zh-Hans.json')
    const en = readSource('i18n/locales/en.json')

    assert.match(aiSettings, /id: 'machineLearning'/)
    assert.match(aiSettings, /'ml\.enabled'/)
    assert.doesNotMatch(aiSettings, /id: 'thirdPartyLogin'/)
    assert.doesNotMatch(aiSettings, /id: 'fileProcessing'/)
    assert.doesNotMatch(aiSettings, /id: 'debug'/)
    assert.doesNotMatch(aiSettings, /auth\.github/)
    assert.doesNotMatch(aiSettings, /auth\.oidc/)
    assert.doesNotMatch(aiSettings, /webglImageViewerDebug/)
    assert.doesNotMatch(aiSettings, /upload\.maxFileSize/)
    assert.doesNotMatch(aiSettings, /upload\.duplicateCheck/)

    assert.doesNotMatch(systemSettings, /id: 'thirdPartyLogin'/)
    assert.doesNotMatch(systemSettings, /auth\.github/)
    assert.doesNotMatch(systemSettings, /auth\.oidc/)
    assert.match(systemSettings, /id: 'fileProcessing'/)
    assert.match(systemSettings, /id: 'debug'/)

    for (const key of [
      'auth.github.enabled',
      'auth.github.clientId',
      'auth.github.clientSecret',
      'auth.oidc.enabled',
      'auth.oidc.label',
      'auth.oidc.issuer',
      'auth.oidc.clientId',
      'auth.oidc.clientSecret',
      'auth.oidc.scope',
      'auth.oidc.clientAuthMethod',
    ]) {
      assert.match(loginSettings, new RegExp(`'${key.replaceAll('.', '\\.')}'`))
    }

    assert.match(dashboardLayout, /title\.thirdPartyLoginSettings/)
    assert.match(dashboardLayout, /\/dashboard\/settings\/login/)
    assert.match(zhHans, /"thirdPartyLoginSettings": "第三方登录"/)
    assert.match(en, /"thirdPartyLoginSettings": "Third-Party Login"/)
  })

  it('groups AI settings by capability on the same page', () => {
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const zhHans = readSource('i18n/locales/zh-Hans.json')
    const en = readSource('i18n/locales/en.json')

    assert.match(aiSettings, /MACHINE_LEARNING_FIELD_GROUPS/)
    for (const groupId of ['base', 'vision', 'semantic', 'face', 'vector']) {
      assert.match(aiSettings, new RegExp(`id: '${groupId}'`))
      assert.match(
        aiSettings,
        new RegExp(`settings\\.system\\.ml\\.groups\\.${groupId}\\.title`),
      )
      assert.match(
        aiSettings,
        new RegExp(
          `settings\\.system\\.ml\\.groups\\.${groupId}\\.description`,
        ),
      )
    }

    assert.match(aiSettings, /settings\.system\.ml\.groups\.actions\.title/)
    assert.match(
      aiSettings,
      /settings\.system\.ml\.groups\.actions\.description/,
    )
    assert.match(aiSettings, /group\.visibleFields/)
    assert.match(aiSettings, /section\.fieldGroups/)
    assert.match(aiSettings, /testMachineLearningCapability\('vlm'\)/)
    assert.match(aiSettings, /\/api\/system\/ml\/test/)
    assert.match(
      aiSettings,
      /enqueueMachineLearningTask\('photo-ml-backfill'\)/,
    )
    assert.match(zhHans, /"groups"/)
    assert.match(zhHans, /"vision": \{\s*"title": "视觉理解"/)
    assert.match(zhHans, /"semantic": \{\s*"title": "语义搜索"/)
    assert.match(en, /"groups"/)
    assert.match(en, /"vision": \{\s*"title": "Vision understanding"/)
    assert.match(en, /"semantic": \{\s*"title": "Semantic search"/)
  })

  it('uses new LocalAI defaults without legacy face-service fallbacks', () => {
    const settingsManager = readSource(
      'server/services/settings/settingsManager.ts',
    )
    const client = readSource('server/services/ml/client.ts')
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const settingField = readSource('app/components/setting/SettingField.vue')
    const settingsTypes = readSource('shared/types/settings.ts')

    assert.doesNotMatch(settingsManager, /lumamemo-face-ai:3005/)
    assert.doesNotMatch(settingsManager, /buffalo_l/)
    assert.match(client, /readMachineLearningSetting/)
    assert.match(client, /readRequiredMachineLearningSetting/)
    assert.match(client, /ml\.localAiBaseUrl/)
    assert.match(client, /normalizeRequiredSettingValue/)
    assert.doesNotMatch(client, /ML_FACE_BASE_URL/)
    assert.doesNotMatch(
      client,
      /ml\.faceModel'[\s\S]{0,120}\|\|[\s\S]{0,80}ML_FACE_MODEL/,
    )
    assert.match(
      aiSettings,
      /LOCALAI_DEFAULT_BASE_URL = 'http:\/\/lumamemo-localai:8080'/,
    )
    assert.doesNotMatch(aiSettings, /LOCALAI_DEFAULT_CLIP_MODEL/)
    assert.match(aiSettings, /normalizeProviderValue/)
    assert.match(aiSettings, /ensureProviderBaseUrls/)
    assert.match(aiSettings, /isSystemFieldVisible/)
    assert.match(aiSettings, /field\.key === 'ml\.enabled'/)
    assert.match(aiSettings, /field\.ui\.visibleIf/)
    assert.match(aiSettings, /systemState\[field\.ui\.visibleIf\.fieldKey\]/)
    assert.match(aiSettings, /isSameVisibleIfValue/)
    assert.doesNotMatch(aiSettings, /LOCALAI_DEFAULT_VLM_MODEL/)
    assert.doesNotMatch(aiSettings, /ensureLocalAiVlmDefaults/)
    assert.doesNotMatch(aiSettings, /normalizeMachineLearningModelDefaults/)
    assert.doesNotMatch(aiSettings, /LEGACY_CLIP_MODEL_VALUES/)
    assert.doesNotMatch(aiSettings, /ViT-B-32__openai/)
    assert.doesNotMatch(aiSettings, /LOCALAI_RECOMMENDED_MODELS_BY_CAPABILITY/)
    assert.doesNotMatch(aiSettings, /reloadLocalAiModels/)
    assert.doesNotMatch(aiSettings, /loadLocalAiModels/)
    assert.doesNotMatch(aiSettings, /localAiModelOptionsByCapability/)
    assert.doesNotMatch(aiSettings, /localAiModelsLoadingByCapability/)
    assert.doesNotMatch(aiSettings, /localAiModelErrorsByCapability/)
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai-models['"`]/)
    assert.match(aiSettings, /visibleFields:/)
    assert.match(aiSettings, /getSectionSubmitFields/)
    assert.match(aiSettings, /section\.visibleFields/)
    assert.match(
      aiSettings,
      /v-if="[\s\S]*section\.id === 'machineLearning'[\s\S]*&&[\s\S]*isMachineLearningEnabled[\s\S]*"/,
    )
    assert.doesNotMatch(aiSettings, /isMachineLearningChildFieldDisabled/)
    assert.doesNotMatch(
      aiSettings,
      /:disabled="isMachineLearningChildFieldDisabled\(section, field\)"/,
    )
    assert.match(aiSettings, /watch\(\s*\(\) => systemState\['ml\.enabled'\]/)
    assert.match(
      aiSettings,
      /watch\(\s*\(\) => \[\s*normalizeProviderValue\(systemState\['ml\.vlmProvider'\]\),?\s*\]/,
    )
    assert.doesNotMatch(aiSettings, /isLocalAiEmbeddingProvider/)
    assert.match(aiSettings, /normalizeMachineLearningSectionData/)
    assert.match(
      aiSettings,
      /JINA_DEFAULT_BASE_URL = 'https:\/\/api\.jina\.ai\/v1'/,
    )
    assert.match(aiSettings, /'ml\.localAiBaseUrl': LOCALAI_DEFAULT_BASE_URL/)
    assert.match(settingField, /select-custom/)
    assert.match(settingField, /handleSelectChange/)
    assert.match(settingField, /value\?\.value \?\? value/)
    assert.match(settingField, /handleComponentUpdate/)
    assert.match(settingField, /handleSelectChange\(value\)/)
    assert.match(settingField, /handleChange\(value\)/)
    assert.match(settingField, /normalizedSelectValue/)
    assert.match(settingField, /propsMap\['value-key'\] = 'value'/)
    assert.match(settingField, /propsMap\['label-key'\] = 'label'/)
    assert.match(
      settingField,
      /field\.ui\.type === 'select' \? normalizedSelectValue : modelValue/,
    )
    assert.doesNotMatch(settingField, /selectedSelectItem/)
    assert.doesNotMatch(
      settingField,
      /field\.ui\.type === 'select' \? selectedSelectItem : modelValue/,
    )
    assert.doesNotMatch(
      settingField,
      /field\.ui\.type === 'select' \? handleSelectChange : handleChange/,
    )
    assert.doesNotMatch(settingField, /optionsPrepareLabel/)
    assert.doesNotMatch(settingField, /optionsCheckLabel/)
    assert.match(settingField, /disabled\?: boolean/)
    assert.match(settingField, /:disabled="disabled"/)
    assert.match(settingField, /opacity-60/)
    assert.match(settingField, /customSelectInput/)
    assert.match(settingField, /dynamicOptions/)
    assert.match(settingField, /optionsLoading/)
    assert.match(settingField, /optionsError/)
    assert.doesNotMatch(settingsTypes, /asyncOptions\?:/)
    assert.doesNotMatch(settingsTypes, /infinity-clip-models/)
    assert.match(settingsTypes, /\| 'select-custom'/)
  })

  it('keeps AI settings lightweight without LocalAI model browsing or downloads', () => {
    const settingsUi = readSource('server/services/settings/ui-config.ts')
    const systemSettings = readSource('app/pages/dashboard/settings/system.vue')
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )
    const localAiModelsApiPath = new URL(
      '../server/api/system/ml/localai-models.get.ts',
      import.meta.url,
    )
    const infinityModelsApiPath = new URL(
      '../server/api/system/ml/infinity-models.get.ts',
      import.meta.url,
    )

    assert.equal(existsSync(localAiModelsApiPath), false)
    assert.equal(existsSync(localAiModelsPath), false)

    assert.doesNotMatch(settingsUi, /asyncOptions/)
    assert.doesNotMatch(settingsUi, /type: 'infinity-clip-models'/)
    assert.doesNotMatch(aiSettings, /INFINITY_CLIP_MODEL_OPTIONS/)
    assert.equal(existsSync(infinityModelsApiPath), false)

    assert.doesNotMatch(aiSettings, /LOCALAI_RECOMMENDED_MODELS_BY_CAPABILITY/)
    assert.doesNotMatch(aiSettings, /lumamemo-qwen3-vl-2b-gpu/)
    assert.doesNotMatch(aiSettings, /lumamemo-qwen3-vl-embedding-2b-gpu/)
    assert.doesNotMatch(aiSettings, /getLocalAiModelCapability/)
    assert.doesNotMatch(aiSettings, /LOCALAI_MODEL_FIELD_CAPABILITIES/)
    assert.doesNotMatch(aiSettings, /openLocalAiModelBrowser/)
    assert.doesNotMatch(aiSettings, /loadLocalAiOfficialModels/)
    assert.doesNotMatch(aiSettings, /applyLocalAiOfficialModel/)
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai\/models/)
    assert.doesNotMatch(aiSettings, /capabilities: capability/)
    assert.doesNotMatch(
      aiSettings,
      /capabilities: LOCALAI_MODEL_CAPABILITIES\.join\(','\)/,
    )
    assert.doesNotMatch(aiSettings, /LOCALAI_MODEL_LOAD_TIMEOUT_MS/)
    assert.doesNotMatch(aiSettings, /modelsByCapability/)
    assert.doesNotMatch(
      aiSettings,
      /settings\.system\.ml\.models\.hardware\.gpu/,
    )
    assert.doesNotMatch(
      aiSettings,
      /settings\.system\.ml\.models\.hardware\.cpu/,
    )
    assert.doesNotMatch(aiSettings, /settings\.system\.ml\.models\.recommended/)
    assert.doesNotMatch(
      aiSettings,
      /settings\.system\.ml\.models\.manualAllowed/,
    )
    assert.doesNotMatch(
      aiSettings,
      /LOCALAI_MODEL_CAPABILITIES\.map\(async \(capability\)/,
    )
    assert.doesNotMatch(aiSettings, /loadInfinityClipModels/)
    assert.doesNotMatch(aiSettings, /infinityClipModel/)
    assert.doesNotMatch(aiSettings, /localAiModelOptions = ref/)
    assert.doesNotMatch(
      aiSettings,
      /isLocalAiModelField\(field\) \? localAiModelOptions\.value/,
    )
    assert.doesNotMatch(systemSettings, /localAiModelOptionsByCapability/)
  })

  it('keeps LocalAI gallery APIs out of LumaMemo', () => {
    const servicePath = new URL(
      '../server/services/ml/localai-official-models.ts',
      import.meta.url,
    )
    const availableApi = new URL(
      '../server/api/system/ml/localai/models/available.get.ts',
      import.meta.url,
    )
    const applyApi = new URL(
      '../server/api/system/ml/localai/models/apply.post.ts',
      import.meta.url,
    )
    const jobsApi = new URL(
      '../server/api/system/ml/localai/models/jobs.get.ts',
      import.meta.url,
    )
    const jobApi = new URL(
      '../server/api/system/ml/localai/models/jobs/[uuid].get.ts',
      import.meta.url,
    )

    assert.equal(existsSync(servicePath), false)
    assert.equal(existsSync(availableApi), false)
    assert.equal(existsSync(applyApi), false)
    assert.equal(existsSync(jobsApi), false)
    assert.equal(existsSync(jobApi), false)
  })

  it('does not ship or mount LumaMemo LocalAI gallery templates', () => {
    const aiCompose = readSource('third-party/ai/docker-compose.yml')
    const env = readSource('.env.example')
    const galleryDir = new URL(
      '../third-party/ai/localai-gallery',
      import.meta.url,
    )
    const galleryIndex = new URL(
      '../third-party/ai/localai-gallery/index.yaml',
      import.meta.url,
    )

    assert.equal(existsSync(galleryDir), false)
    assert.equal(existsSync(galleryIndex), false)
    assert.doesNotMatch(aiCompose, /\/models\/lumamemo-gallery:ro/)
    assert.doesNotMatch(
      aiCompose,
      /file:\/\/\/models\/lumamemo-gallery\/index\.yaml/,
    )
    assert.doesNotMatch(aiCompose, /"name":"lumamemo"/)
    assert.match(
      aiCompose,
      /github:mudler\/LocalAI\/gallery\/index\.yaml@master/,
    )
    assert.doesNotMatch(env, /LOCALAI_CPU_IMAGE/)
  })

  it('keeps AI settings free of legacy hardcoded LocalAI model management', () => {
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const settingField = readSource('app/components/setting/SettingField.vue')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )
    const ensureApiPath = new URL(
      '../server/api/system/ml/localai-models/ensure.post.ts',
      import.meta.url,
    )
    const checkApiPath = new URL(
      '../server/api/system/ml/localai-models/check.post.ts',
      import.meta.url,
    )
    const listApiPath = new URL(
      '../server/api/system/ml/localai-models.get.ts',
      import.meta.url,
    )

    assert.doesNotMatch(aiSettings, /LOCALAI_RECOMMENDED_MODELS_BY_CAPABILITY/)
    assert.doesNotMatch(aiSettings, /getStaticLocalAiModelOptions/)
    assert.doesNotMatch(aiSettings, /lumamemo-qwen3-vl-2b-gpu/)
    assert.doesNotMatch(aiSettings, /lumamemo-qwen3-vl-2b-cpu/)
    assert.doesNotMatch(aiSettings, /lumamemo-qwen3-vl-embedding-2b-gpu/)
    assert.doesNotMatch(aiSettings, /lumamemo-qwen3-vl-embedding-2b-cpu/)
    assert.doesNotMatch(aiSettings, /LOCALAI_MODEL_LOAD_TIMEOUT_MS/)
    assert.doesNotMatch(aiSettings, /clearScheduledLocalAiModelsLoad/)
    assert.doesNotMatch(aiSettings, /reloadLocalAiModels/)
    assert.doesNotMatch(aiSettings, /resetLocalAiModelOptions/)
    assert.doesNotMatch(aiSettings, /localAiModelsLoadedByCapability/)
    assert.doesNotMatch(aiSettings, /localAiModelsLoadingByCapability/)
    assert.doesNotMatch(aiSettings, /modelsByCapability/)
    assert.doesNotMatch(aiSettings, /LOCALAI_MODEL_CAPABILITIES/)
    assert.doesNotMatch(aiSettings, /localAiModelsLoadTimer/)
    assert.doesNotMatch(aiSettings, /localAiModelErrorsByCapability/)
    assert.doesNotMatch(aiSettings, /@retry-options/)
    assert.doesNotMatch(aiSettings, /@prepare-options/)
    assert.doesNotMatch(aiSettings, /@check-options/)
    assert.doesNotMatch(
      aiSettings,
      /settings\.system\.ml\.models\.(reload|retry|loadHint|prepare|check)/,
    )
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai-models/)

    assert.doesNotMatch(settingField, /optionsPrepareLabel/)
    assert.doesNotMatch(settingField, /optionsCheckLabel/)
    assert.doesNotMatch(settingField, /optionsActionLoading/)
    assert.doesNotMatch(settingField, /optionsStatusDescription/)
    assert.doesNotMatch(settingField, /'prepare-options': \[\]/)
    assert.doesNotMatch(settingField, /'check-options': \[\]/)
    assert.doesNotMatch(settingField, /emit\('prepare-options'\)/)
    assert.doesNotMatch(settingField, /emit\('check-options'\)/)

    assert.equal(existsSync(localAiModelsPath), false)
    assert.equal(existsSync(ensureApiPath), false)
    assert.equal(existsSync(checkApiPath), false)
    assert.equal(existsSync(listApiPath), false)
  })

  it('treats LocalAI as an external service without app-level model lifecycle management', () => {
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const manager = readSource('server/services/pipeline-queue/manager.ts')
    const singleSettingApi = readSource(
      'server/api/system/settings/[namespace]/[key].ts',
    )
    const batchSettingApi = readSource(
      'server/api/system/settings/batch.put.ts',
    )
    const settingsConstants = readSource('server/services/settings/contants.ts')
    const healthApi = readSource('server/api/system/ml/health.get.ts')
    const zhHans = readSource('i18n/locales/zh-Hans.json')
    const en = readSource('i18n/locales/en.json')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )
    const ensureApiPath = new URL(
      '../server/api/system/ml/localai-models/ensure.post.ts',
      import.meta.url,
    )
    const checkApiPath = new URL(
      '../server/api/system/ml/localai-models/check.post.ts',
      import.meta.url,
    )

    assert.doesNotMatch(manager, /localAiModelEnsure/)
    assert.doesNotMatch(manager, /model download requested/)
    assert.doesNotMatch(manager, /ready \$\{result\.modelName\}/)
    assert.doesNotMatch(singleSettingApi, /enqueueEnabledLocalAiModelEnsures/)
    assert.doesNotMatch(batchSettingApi, /enqueueEnabledLocalAiModelEnsures/)
    assert.doesNotMatch(batchSettingApi, /mlOverrides/)
    assert.doesNotMatch(settingsConstants, /key: 'ml\.localAiModelStatus'/)
    assert.doesNotMatch(aiSettings, /LocalAiModelStatus/)
    assert.doesNotMatch(aiSettings, /getLocalAiModelStatusDescription/)
    assert.doesNotMatch(aiSettings, /settings\.system\.ml\.models\.status/)
    assert.match(healthApi, /checkHealth/)

    assert.equal(existsSync(localAiModelsPath), false)
    assert.equal(existsSync(ensureApiPath), false)
    assert.equal(existsSync(checkApiPath), false)

    assert.doesNotMatch(zhHans, /"localai-model-ensure"/)
    assert.doesNotMatch(zhHans, /"localAiModelStatus"/)
    assert.doesNotMatch(en, /"localai-model-ensure"/)
    assert.doesNotMatch(en, /"localAiModelStatus"/)
  })

  it('uses configured model names directly without runtime readiness gates', () => {
    const client = readSource('server/services/ml/client.ts')
    const indexer = readSource('server/services/ml/photo-indexer.ts')
    const manager = readSource('server/services/pipeline-queue/manager.ts')
    const zhHans = readSource('i18n/locales/zh-Hans.json')
    const en = readSource('i18n/locales/en.json')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )

    assert.equal(existsSync(localAiModelsPath), false)

    assert.doesNotMatch(client, /resolveConfiguredModelName/)
    assert.doesNotMatch(client, /getReadyLocalAiRuntimeModelName/)
    assert.doesNotMatch(client, /LocalAI model is not ready/)
    assert.doesNotMatch(client, /ml\.localAiModelStatus/)
    assert.match(client, /probeChatCompletion/)
    assert.match(client, /probeFaceModel/)

    assert.doesNotMatch(indexer, /getReadyLocalAiRuntimeModelName/)
    assert.match(indexer, /const embeddingModel = settings\.embeddingModel/)
    assert.match(indexer, /const vlmModel = settings\.vlmModel/)
    assert.match(indexer, /const faceModel = settings\.faceModel/)
    assert.match(
      indexer,
      /upsertPhotoEmbedding\(photo, embeddingModel, embedding\)/,
    )
    assert.match(indexer, /modelName: faceModel/)

    assert.doesNotMatch(manager, /LocalAI model is not ready/)
    assert.doesNotMatch(manager, /model-not-ready/)
    assert.match(
      manager,
      /lte\(tables\.pipelineQueue\.createdAt,\s*new Date\(\)\)/,
    )
    assert.doesNotMatch(manager, /LOCALAI_MODEL_NOT_READY_MAX_DELAYS/)
    assert.doesNotMatch(manager, /modelNotReadyDelays/)

    assert.doesNotMatch(zhHans, /"registered": "已注册，正在验证"/)
    assert.doesNotMatch(zhHans, /"modelNotReady": "模型未就绪，稍后自动重试"/)
    assert.doesNotMatch(en, /"registered": "Registered, validating"/)
    assert.doesNotMatch(
      en,
      /"modelNotReady": "Model is not ready; retrying later"/,
    )
  })

  it('does not expose LocalAI runtime YAML management in LumaMemo settings', () => {
    const compose = readSource('docker-compose.yml')
    const aiCompose = readSource('third-party/ai/docker-compose.yml')
    const env = readSource('.env.example')
    const settingsConstants = readSource('server/services/settings/contants.ts')
    const settingsUi = readSource('server/services/settings/ui-config.ts')
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const zhHans = readSource('i18n/locales/zh-Hans.json')
    const en = readSource('i18n/locales/en.json')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )

    assert.match(
      compose,
      /data\/ai\/localai\/models:\/app\/data\/ai\/localai\/models/,
    )
    assert.doesNotMatch(env, /ML_LOCALAI_MODELS_PATH/)
    assert.match(aiCompose, /LOCALAI_MAX_ACTIVE_BACKENDS/)
    assert.match(aiCompose, /LOCALAI_WATCHDOG_IDLE/)
    assert.match(aiCompose, /LOCALAI_WATCHDOG_BUSY/)

    for (const key of [
      'ml.localAiModelsPath',
      'ml.localAiContextSize',
      'ml.localAiThreads',
      'ml.localAiF16',
      'ml.localAiGpuLayers',
      'ml.localAiMmap',
      'ml.localAiLowVram',
      'ml.localAiNoKvOffloading',
      'ml.localAiMmprojUseGpu',
      'ml.localAiImageMinTokens',
      'ml.localAiImageMaxTokens',
      'ml.localAiPoolingType',
      'ml.localAiEmbdNormalize',
      'ml.localAiOptions',
    ]) {
      assert.doesNotMatch(
        settingsConstants,
        new RegExp(`key: '${key.replace(/\./g, '\\.')}'`),
      )
      assert.doesNotMatch(
        settingsUi,
        new RegExp(`'${key.replace(/\./g, '\\.')}': \\{`),
      )
      assert.doesNotMatch(
        aiSettings,
        new RegExp(`'${key.replace(/\./g, '\\.')}'`),
      )
      assert.doesNotMatch(zhHans, new RegExp(`"${key.replace('ml.', '')}"`))
      assert.doesNotMatch(en, new RegExp(`"${key.replace('ml.', '')}"`))
    }

    assert.equal(existsSync(localAiModelsPath), false)
    assert.doesNotMatch(
      aiSettings,
      /settings\.system\.ml\.models\.status\.failed/,
    )
    assert.doesNotMatch(zhHans, /"failed": "推理验证失败"/)
    assert.doesNotMatch(en, /"failed": "Inference validation failed"/)
  })

  it('does not use LocalAI official model APIs for preview or downloads', () => {
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const readme = readSource('third-party/ai/README.md')
    const availableApi = new URL(
      '../server/api/system/ml/localai/models/available.get.ts',
      import.meta.url,
    )
    const applyApi = new URL(
      '../server/api/system/ml/localai/models/apply.post.ts',
      import.meta.url,
    )
    const jobsApi = new URL(
      '../server/api/system/ml/localai/models/jobs.get.ts',
      import.meta.url,
    )
    const jobApi = new URL(
      '../server/api/system/ml/localai/models/jobs/[uuid].get.ts',
      import.meta.url,
    )
    const localAiModels = new URL(
      '../server/services/ml/localai-official-models.ts',
      import.meta.url,
    )
    const scriptPath = new URL(
      '../third-party/ai/scripts/download-localai-model.sh',
      import.meta.url,
    )
    const galleryDir = new URL(
      '../third-party/ai/localai-gallery',
      import.meta.url,
    )
    const faceTemplatePath = new URL(
      '../third-party/ai/localai-gallery/insightface-buffalo-l.yaml',
      import.meta.url,
    )

    assert.doesNotMatch(
      aiSettings,
      /prepareLocalAiModel\(field: FieldDescriptor\)/,
    )
    assert.doesNotMatch(
      aiSettings,
      /checkLocalAiModel\(field: FieldDescriptor\)/,
    )
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai-models\/ensure/)
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai-models\/check/)

    assert.equal(existsSync(scriptPath), false)
    assert.equal(existsSync(galleryDir), false)
    assert.equal(existsSync(faceTemplatePath), false)

    assert.equal(existsSync(availableApi), false)
    assert.equal(existsSync(applyApi), false)
    assert.equal(existsSync(jobsApi), false)
    assert.equal(existsSync(jobApi), false)
    assert.equal(existsSync(localAiModels), false)

    assert.doesNotMatch(aiSettings, /openLocalAiModelBrowser\(field\)/)
    assert.doesNotMatch(aiSettings, /loadLocalAiOfficialModels/)
    assert.doesNotMatch(aiSettings, /applyLocalAiOfficialModel/)
    assert.doesNotMatch(
      aiSettings,
      /\/api\/system\/ml\/localai\/models\/available/,
    )
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai\/models\/apply/)
    assert.doesNotMatch(aiSettings, /\/api\/system\/ml\/localai\/models\/jobs/)
    assert.doesNotMatch(
      aiSettings,
      /watch\([\s\S]{0,300}loadLocalAiOfficialModels/,
    )
    assert.doesNotMatch(
      aiSettings,
      /onMounted\([\s\S]{0,300}loadLocalAiOfficialModels/,
    )

    assert.doesNotMatch(readme, /download-localai-model\.sh/)
    assert.doesNotMatch(readme, /insightface-buffalo-l/)
    assert.match(readme, /http:\/\/localhost:18080\/browse/)
    assert.doesNotMatch(readme, /models\/available/)
    assert.doesNotMatch(readme, /models\/apply/)
    assert.match(readme, /LumaMemo does not install LocalAI models/i)
  })

  it('implements a Jina embedding ML client and independent health probes', () => {
    const client = readSource('server/services/ml/client.ts')
    const health = readSource('server/api/system/ml/health.get.ts')
    const testApi = readSource('server/api/system/ml/test.post.ts')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )
    const localAiModelsApiPath = new URL(
      '../server/api/system/ml/localai-models.get.ts',
      import.meta.url,
    )

    assert.match(client, /analyzeImage/)
    assert.match(client, /embedImage/)
    assert.match(client, /embedText/)
    assert.match(client, /describeImage/)
    assert.doesNotMatch(client, /scoreAesthetic/)
    assert.doesNotMatch(client, /infinityBaseUrl/)
    assert.match(client, /new URL\('v1\/models'/)
    assert.match(client, /new URL\('embeddings'/)
    assert.match(client, /probeImageEmbedding/)
    assert.match(client, /probeTextEmbedding/)
    assert.match(client, /testImageEmbedding/)
    assert.match(client, /testTextEmbedding/)
    assert.match(client, /serializeMachineLearningError/)
    assert.match(client, /detectFaces/)
    assert.match(client, /v1\/face\/analyze/)
    assert.match(client, /actions: \[\]/)
    assert.match(client, /anti_spoofing: false/)
    assert.match(client, /vlmProvider/)
    assert.doesNotMatch(client, /embeddingProvider/)
    assert.match(client, /embeddingBaseUrl/)
    assert.match(client, /embeddingApiKey/)
    assert.match(client, /chat\/completions/)
    assert.doesNotMatch(client, /api\/chat/)
    assert.doesNotMatch(client, /api\/embed/)
    assert.match(client, /Authorization[\s\S]*Bearer/)
    assert.match(
      client,
      /JINA_DEFAULT_BASE_URL = 'https:\/\/api\.jina\.ai\/v1'/,
    )
    assert.match(client, /embedding_type: 'float'/)
    assert.match(client, /normalized: true/)
    assert.match(client, /image: imageToBase64\(image\)/)
    assert.match(client, /TEST_FACE_IMAGE_SOURCE/)
    assert.match(client, /TEST_FACE_IMAGE_BASE64/)
    assert.match(client, /createMachineLearningTestImageMetadata/)
    assert.doesNotMatch(client, /const TEST_JPEG_BASE64/)
    assert.doesNotMatch(client, /image: imageToBase64\(onePixelJpeg\)/)
    assert.match(client, /image: imageToBase64\(testImage\)/)
    assert.match(client, /image_url: \{ url: imageToDataUrl\(image\) \}/)
    assert.doesNotMatch(client, /image: imageToDataUrl\(image\)/)
    assert.doesNotMatch(client, /bytes: imageToBase64\(image\)/)
    assert.match(client, /localAiNeeded/)
    assert.match(client, /skipped: true/)
    assert.match(client, /vlmBaseUrl/)
    assert.match(client, /vectorBaseUrl/)
    assert.match(client, /localAiBaseUrl/)
    assert.doesNotMatch(client, /Immich/)
    assert.doesNotMatch(client, /\/predict/)
    assert.match(client, /new URL\('v1\/models'/)
    assert.match(client, /responseBody/)
    assert.match(health, /requireAdminSession/)
    assert.match(health, /assertMachineLearningEnabled/)
    assert.match(health, /assertMachineLearningAvailable/)
    assert.match(health, /checkHealth/)
    assert.match(health, /embeddingModel/)
    assert.match(health, /embeddingProbe/)
    assert.match(health, /vlmProbe/)
    assert.match(testApi, /requireAdminSession/)
    assert.match(testApi, /capability:[\s\S]*vlm[\s\S]*embedding[\s\S]*face/)
    assert.match(testApi, /createMachineLearningClient/)
    assert.match(testApi, /testTextEmbedding/)
    assert.match(testApi, /testImageEmbedding/)
    assert.match(testApi, /ml\.language/)
    assert.match(testApi, /resolveMachineLearningLanguageName/)
    assert.doesNotMatch(testApi, /settings\.vlmModel,\s*'English'/)
    assert.match(testApi, /textEmbeddingDim/)
    assert.match(testApi, /imageEmbeddingDim/)
    assert.match(testApi, /formatProbeFailure/)
    assert.match(testApi, /extractServiceErrorMessage/)
    assert.match(testApi, /assertJinaImageEmbeddingModel/)
    assert.match(testApi, /requestedModel/)
    assert.match(testApi, /createMachineLearningTestImageMetadata/)
    assert.match(testApi, /probe\.body/)
    assert.doesNotMatch(
      testApi,
      /error: probe\.ok \? null : 'Face model test request failed'/,
    )
    assert.match(testApi, /durationMs/)
    assert.match(testApi, /serializeMachineLearningError/)
    assert.match(health, /faceProbe/)
    assert.match(health, /vlmReady/)
    assert.match(health, /embeddingReady/)
    assert.match(health, /faceReady/)
    assert.doesNotMatch(health, /success: vector\.ok && health\.localAi\.ok/)
    assert.equal(existsSync(localAiModelsApiPath), false)
    assert.equal(existsSync(localAiModelsPath), false)
    assert.doesNotMatch(client, /models\/apply/)
    assert.doesNotMatch(client, /requestLocalAiModelDownload/)
  })

  it('adds independently retryable ML queue payloads without LocalAI model management tasks', () => {
    const sqliteSchema = readSource('server/database/schema.ts')
    const postgresSchema = readSource('server/database/schema/postgres.ts')
    const manager = readSource('server/services/pipeline-queue/manager.ts')
    const addTask = readSource('server/api/queue/add-task.post.ts')
    const addTasks = readSource('server/api/queue/add-tasks.post.ts')
    const mlQueue = readSource('server/utils/ml-queue.ts')
    const localAiModelsPath = new URL(
      '../server/services/ml/localai-models.ts',
      import.meta.url,
    )

    for (const source of [sqliteSchema, postgresSchema, addTask]) {
      assert.match(source, /photo-ml-index/)
      assert.match(source, /photo-ml-backfill/)
      assert.match(source, /photo-face-cluster/)
      assert.match(source, /photo-ml-auto-tags/)
      assert.match(source, /photo-ml-semantic-embedding/)
      assert.match(source, /photo-ai-analysis/)
      assert.doesNotMatch(source, /photo-aesthetic-score/)
      assert.match(source, /photo-face-detect/)
      assert.doesNotMatch(source, /localai-model-ensure/)
    }
    assert.match(manager, /enqueueMachineLearningIndexTask/)
    assert.match(manager, /processors\.machineLearningAutoTags/)
    assert.match(manager, /processors\.machineLearningSemanticEmbedding/)
    assert.match(manager, /processors\.photoAiAnalysis/)
    assert.doesNotMatch(manager, /processors\.photoAestheticScore/)
    assert.doesNotMatch(manager, /processors\.localAiModelEnsure/)
    assert.match(manager, /processors\.faceDetect/)
    assert.match(manager, /processors\.faceCluster/)
    assert.match(
      manager,
      /enqueueMachineLearningIndexTask[\s\S]*ml\.enabled[\s\S]*addTask/,
    )
    assert.doesNotMatch(
      manager,
      /enqueueMachineLearningIndexTask[\s\S]{0,500}ml\.autoTag\.enabled/,
    )
    assert.match(
      manager,
      /enqueueMachineLearningAutoTagTask[\s\S]*ml\.autoTag\.enabled/,
    )
    assert.match(
      manager,
      /enqueueMachineLearningSemanticEmbeddingTask[\s\S]*ml\.semanticSearch\.enabled/,
    )
    assert.equal(existsSync(localAiModelsPath), false)
    assert.doesNotMatch(manager, /localAiModelEnsure/)
    assert.match(
      manager,
      /faceCluster[\s\S]*ml\.enabled[\s\S]*Machine learning is disabled/,
    )
    assert.match(addTask, /assertMachineLearningQueuePayloadEnabled/)
    assert.match(addTask, /isMachineLearningQueuePayload/)
    assert.match(addTasks, /assertMachineLearningQueuePayloadEnabled/)
    assert.match(addTasks, /isMachineLearningQueuePayload/)
    assert.match(mlQueue, /Machine learning is disabled/)
  })

  it('provides semantic search using Qdrant instead of filename matching', () => {
    const endpoint = readSource('server/api/photos/search/semantic.get.ts')

    assert.match(endpoint, /requireActiveUserSession/)
    assert.match(endpoint, /assertMachineLearningEnabled/)
    assert.match(endpoint, /ml\.semanticSearch\.enabled/)
    assert.match(endpoint, /embedText/)
    assert.match(endpoint, /searchPhotoEmbeddings/)
    assert.match(endpoint, /embeddingModel/)
    assert.match(endpoint, /ownerUserId/)
    assert.match(endpoint, /DEFAULT_SEMANTIC_MIN_SCORE = 0\.6/)
    assert.match(endpoint, /DEFAULT_SEMANTIC_SCORE_RATIO = 0\.94/)
    assert.match(endpoint, /filterSemanticMatches/)
    assert.doesNotMatch(endpoint, /photo_embeddings/)
    assert.doesNotMatch(endpoint, /embedding <=>/)
    assert.doesNotMatch(endpoint, /storageKey[\s\S]*includes/)
  })

  it('degrades semantic search when embedding or vector services are unavailable', () => {
    const adminEndpoint = readSource('server/api/photos/search/semantic.get.ts')
    const publicEndpoint = readSource(
      'server/api/public/profiles/[publicId]/photos/search/semantic.get.ts',
    )
    const filters = readSource('app/composables/usePhotoFilters.ts')
    const vectorStore = readSource('server/services/ml/vector-store.ts')

    for (const endpoint of [adminEndpoint, publicEndpoint]) {
      assert.match(endpoint, /assertMachineLearningEnabled/)
      assert.match(endpoint, /ml\.semanticSearch\.enabled/)
      assert.match(endpoint, /semantic-unavailable/)
      assert.match(endpoint, /degraded: true/)
      assert.match(endpoint, /results: \[\]/)
      assert.match(endpoint, /logger\.dynamic\('semantic-search'\)/)
      assert.match(endpoint, /catch \(error\)/)
      assert.match(endpoint, /minScore/)
    }

    assert.match(filters, /degraded\?: boolean/)
    assert.match(filters, /response\.degraded/)
    assert.match(filters, /semanticSearchDegraded/)
    assert.match(filters, /SEMANTIC_SEARCH_LIMIT/)
    assert.doesNotMatch(filters, /Math\.max\(photos\.value\.length,\s*30\)/)
    assert.doesNotMatch(filters, /semanticResultIds\.value = new Set\(\)\s*$/m)
    assert.match(vectorStore, /score_threshold/)
    assert.match(vectorStore, /updatePhotoVisibility/)
    assert.match(vectorStore, /points\/payload\?wait=true/)
  })

  it('loads admin photos with face metadata without malformed PostgreSQL array parameters', () => {
    const endpoint = readSource('server/api/photos/index.get.ts')

    assert.match(endpoint, /listFacePayloads/)
    assert.match(endpoint, /attachMachineLearningMetadata/)
    assert.match(endpoint, /defaultMachineLearningStatus/)
    assert.match(endpoint, /catch \(error\)/)
    assert.match(endpoint, /logger\.dynamic\('photos-api'\)/)
    assert.doesNotMatch(endpoint, /any\(\$\{photoIds\}\)/)
    assert.doesNotMatch(endpoint, /photo_faces/)
    assert.doesNotMatch(endpoint, /postgresTables\.photoFaces/)
  })

  it('provides public semantic search scoped to public profile visibility', () => {
    const endpoint = readSource(
      'server/api/public/profiles/[publicId]/photos/search/semantic.get.ts',
    )

    assert.match(endpoint, /getSafeUserSession/)
    assert.match(endpoint, /canViewOwnerPrivateContent/)
    assert.match(endpoint, /homepageVisibility/)
    assert.match(endpoint, /visibility/)
    assert.match(endpoint, /embedText/)
    assert.match(endpoint, /searchPhotoEmbeddings/)
    assert.match(endpoint, /embeddingModel/)
    assert.match(endpoint, /ownerUserId/)
    assert.match(endpoint, /filterSemanticMatches/)
    assert.match(endpoint, /Math\.min\(query\.limit \* 3,\s*100\)/)
    assert.doesNotMatch(endpoint, /visibility:\s*isOwner \? undefined : 'public'/)
    assert.doesNotMatch(endpoint, /photo_embeddings/)
    assert.doesNotMatch(endpoint, /embedding <=>/)
  })

  it('implements face detection, people APIs, and person photo lookup', () => {
    const client = readSource('server/services/ml/client.ts')
    const indexer = readSource('server/services/ml/photo-indexer.ts')
    const peopleList = readFirstExistingSource(
      'server/api/people.get.ts',
      'server/api/people/index.get.ts',
    )
    const personPatch = readSource(
      'server/api/people/[personId]/index.patch.ts',
    )
    const personPhotos = readSource(
      'server/api/people/[personId]/photos.get.ts',
    )
    const assignFace = readSource('server/api/faces/[faceId]/person.patch.ts')
    const mergePeoplePath = new URL(
      '../server/api/people/merge.post.ts',
      import.meta.url,
    )

    assert.match(client, /detectFaces/)
    assert.match(client, /v1\/face\/analyze/)
    assert.match(client, /v1\/face\/embed/)
    assert.doesNotMatch(client, /v1\/face\/detect/)
    assert.match(indexer, /indexPhotoFaces/)
    assert.match(indexer, /generateFaceCrop/)
    assert.match(indexer, /buildEmbeddingInput/)
    assert.match(indexer, /cropStorageKey/)
    assert.doesNotMatch(indexer, /photo_faces/)
    assert.doesNotMatch(indexer, /photo_auto_tags/)
    assert.match(indexer, /upsertFaceEmbedding/)
    assert.doesNotMatch(indexer, /face_embeddings/)
    assert.match(indexer, /clusterFacesForOwner/)
    assert.match(peopleList, /requireActiveUserSession/)
    assert.match(
      peopleList,
      /isMachineLearningFeatureEnabled\('ml\.faceAlbum\.enabled'\)/,
    )
    assert.match(peopleList, /faceCount/)
    assert.match(peopleList, /photoCount/)
    assert.match(
      peopleList,
      /new Set\(personFaces\.map\(\(face\) => face\.photoId\)\)\.size/,
    )
    assert.match(personPatch, /name/)
    assert.match(
      personPatch,
      /assertMachineLearningFeatureEnabled\([\s\S]*'ml\.faceAlbum\.enabled'/,
    )
    assert.match(personPatch, /isHidden/)
    assert.match(personPatch, /isFavorite/)
    assert.match(
      personPatch,
      /import \{ tables, useDB \} from ['"]~~\/server\/utils\/db['"]/,
    )
    assert.doesNotMatch(personPatch, /assertMachineLearningAvailable/)
    assert.match(personPhotos, /listFacePayloads/)
    assert.match(
      personPhotos,
      /isMachineLearningFeatureEnabled\('ml\.faceAlbum\.enabled'\)/,
    )
    assert.match(personPhotos, /photoFaces/)
    assert.match(personPhotos, /cropUrl/)
    assert.doesNotMatch(personPhotos, /photo_faces/)
    assert.equal(existsSync(mergePeoplePath), false)
    assert.match(assignFace, /personId/)
    assert.match(
      assignFace,
      /assertMachineLearningFeatureEnabled\([\s\S]*'ml\.faceAlbum\.enabled'/,
    )
    assert.match(
      assignFace,
      /import \{ tables, useDB \} from ['"]~~\/server\/utils\/db['"]/,
    )
  })

  it('runs ML stages as independently retryable queue tasks', () => {
    const indexer = readSource('server/services/ml/photo-indexer.ts')
    const manager = readSource('server/services/pipeline-queue/manager.ts')
    const addTask = readSource('server/api/queue/add-task.post.ts')

    assert.match(indexer, /indexPhotoAutoTags/)
    assert.match(indexer, /indexPhotoSemanticEmbedding/)
    assert.match(
      indexer,
      /const \{ photo, image \} = await getPhotoAndImageForMachineLearning\(photoId\)[\s\S]*const embedding = await client\.embedImage\(image, embeddingModel\)/,
    )
    assert.doesNotMatch(
      indexer,
      /client\.embedText\(embeddingInput, embeddingModel\)/,
    )
    assert.match(indexer, /indexPhotoFaces/)
    assert.match(indexer, /indexPhotoAiAnalysis/)
    assert.doesNotMatch(indexer, /indexPhotoAestheticScore/)
    assert.match(
      manager,
      /photo-ml-index[\s\S]*enqueueMachineLearningSemanticEmbeddingTask[\s\S]*enqueuePhotoAiAnalysisTask[\s\S]*enqueueFaceDetectTask/,
    )
    assert.doesNotMatch(
      manager,
      /machineLearningIndex:[\s\S]*enqueueMachineLearningAutoTagTask/,
    )
    assert.doesNotMatch(manager, /enqueuePhotoAestheticScoreTask/)
    assert.match(manager, /machineLearningAutoTags/)
    assert.match(manager, /machineLearningSemanticEmbedding/)
    assert.match(manager, /faceDetect/)
    assert.match(manager, /photoAiAnalysis/)
    assert.doesNotMatch(manager, /photoAestheticScore/)
    assert.match(addTask, /photo-ml-auto-tags/)
    assert.match(addTask, /photo-ml-semantic-embedding/)
    assert.match(addTask, /photo-ai-analysis/)
    assert.doesNotMatch(addTask, /photo-aesthetic-score/)
    assert.match(addTask, /photo-face-detect/)
  })

  it('queues ML backfill instead of pretending empty face clustering succeeded', () => {
    const manager = readSource('server/services/pipeline-queue/manager.ts')

    assert.match(manager, /countFacePayloads/)
    assert.match(manager, /no-indexed-faces/)
    assert.match(manager, /photo-face-detect/)
    assert.match(manager, /0 indexed faces available for clustering/)
  })

  it('deduplicates face clustering tasks queued by repeated face extraction', () => {
    const manager = readSource('server/services/pipeline-queue/manager.ts')

    assert.match(manager, /findPendingFaceClusterTask/)
    assert.match(manager, /photo-face-cluster/)
    assert.match(manager, /async addTask[\s\S]*findPendingFaceClusterTask/)
    assert.match(
      manager,
      /status === 'pending' \|\| task\.status === 'in-stages'/,
    )
    assert.match(manager, /existingClusterTaskId/)
  })

  it('exposes ML controls and semantic/person search in existing frontend surfaces', () => {
    const aiSettings = readSource('app/pages/dashboard/settings/ai.vue')
    const filters = readSource('app/composables/usePhotoFilters.ts')
    const filterPanel = readSource('app/components/overlay/FilterPanel.vue')
    const photoInfo = readSource('app/components/photo/InfoPanel.vue')
    const client = readSource('server/services/ml/client.ts')
    const photoViewer = readSource('app/components/photo/Viewer.vue')
    const dashboardLayout = readSource('app/layouts/dashboard.vue')
    const peoplePage = readSource('app/pages/dashboard/people.vue')
    const publicRoutes = readSource('app/utils/public-profile-routes.ts')
    const masonryRoot = readSource('app/components/masonry/Root.vue')
    const publicProfile = readSource(
      'app/components/public/PublicProfileMasonry.vue',
    )
    const publicPeople = readSource('app/pages/u/[publicId]/people/index.vue')
    const publicPerson = readSource(
      'app/pages/u/[publicId]/people/[personId].vue',
    )
    const publicPeopleApi = readSource(
      'server/api/public/profiles/[publicId]/people.get.ts',
    )
    const publicPersonPhotosApi = readSource(
      'server/api/public/profiles/[publicId]/people/[personId]/photos.get.ts',
    )
    const publicPhotoDetailApi = readSource(
      'server/api/public/profiles/[publicId]/photos/[photoId]/detail.get.ts',
    )

    assert.match(aiSettings, /testMachineLearningCapability\('vlm'\)/)
    assert.match(aiSettings, /testMachineLearningCapability\('embedding'\)/)
    assert.match(aiSettings, /testMachineLearningCapability\('face'\)/)
    assert.match(aiSettings, /\/api\/system\/ml\/test/)
    assert.match(aiSettings, /getMachineLearningTestPayload/)
    assert.match(aiSettings, /settings: getMachineLearningTestPayload\(\)/)
    assert.match(aiSettings, /type="button"/)
    assert.match(aiSettings, /requestedModel/)
    assert.match(aiSettings, /ml\.language/)
    assert.match(aiSettings, /'ml\.language', 'ml\.enabled'/)
    assert.ok(
      aiSettings.indexOf("'ml.language'") < aiSettings.indexOf("'ml.enabled'"),
      'AI output language should be the first quick setting in the base group',
    )
    assert.match(aiSettings, /getGroupTestCapability\(group\.id\)/)
    assert.match(aiSettings, /groupId === 'vision'/)
    assert.match(aiSettings, /groupId === 'semantic'/)
    assert.match(aiSettings, /groupId === 'face'/)
    assert.ok(
      aiSettings.indexOf("testMachineLearningCapability('vlm')") <
        aiSettings.indexOf('settings.system.ml.groups.actions.title'),
      'vision test button should live in the capability group area, not bottom actions',
    )
    assert.ok(
      aiSettings.indexOf("testMachineLearningCapability('embedding')") <
        aiSettings.indexOf('settings.system.ml.groups.actions.title'),
      'embedding test button should live in the capability group area, not bottom actions',
    )
    assert.ok(
      aiSettings.indexOf("testMachineLearningCapability('face')") <
        aiSettings.indexOf('settings.system.ml.groups.actions.title'),
      'face test button should live in the capability group area, not bottom actions',
    )
    assert.match(aiSettings, /validateMachineLearningSectionData/)
    assert.match(aiSettings, /ml\.embeddingModel/)
    assert.match(aiSettings, /enqueueMachineLearningTask/)
    assert.match(aiSettings, /photo-ml-backfill/)
    assert.match(aiSettings, /photo-face-cluster/)
    assert.match(dashboardLayout, /title\.aiSettings/)
    assert.match(dashboardLayout, /\/dashboard\/settings\/ai/)
    assert.match(filters, /smartSearch/)
    assert.match(filters, /semanticResultIds/)
    assert.match(filters, /semanticSearch/)
    assert.match(filters, /keywordSearchMatches/)
    assert.match(filters, /advancedSearchEnabled/)
    assert.match(filters, /activeFilters\.value\.advancedSearch/)
    assert.match(
      filters,
      /if \(!activeFilters\.value\.advancedSearch\) \{\s*semanticResultIds\.value = null\s*semanticError\.value = null\s*return/s,
    )
    assert.match(filterPanel, /advancedSearchEnabled/)
    assert.match(filterPanel, /@click="smartSearch"/)
    assert.match(filterPanel, /@keydown\.enter="smartSearch"/)
    assert.doesNotMatch(filterPanel, /watch\(searchQuery/)
    assert.match(filterPanel, /semantic/)
    assert.match(filterPanel, /people/)
    assert.equal(
      filterPanel.match(/v-if="semanticError"/g)?.length,
      1,
      'semantic unavailable notice should render once',
    )
    assert.ok(
      filterPanel.indexOf('v-if="semanticError"') <
        filterPanel.indexOf('<UTabs'),
      'semantic unavailable notice must stay outside UTabs so tab options are not replaced',
    )
    assert.doesNotMatch(filterPanel, /searchMode === 'semantic'/)
    assert.match(client, /resolveMachineLearningLanguage/)
    assert.match(client, /system', 'ml\.language'/)
    assert.match(client, /location', 'language'/)
    assert.match(client, /languageName/)
    assert.match(client, /Return all textual fields in/)
    assert.match(client, /tags must use/)
    assert.match(photoInfo, /photoFaces/)
    assert.match(photoInfo, /useSettingRef\('system:ml\.enabled'\)/)
    assert.match(photoInfo, /const isAiEnabled = computed/)
    assert.match(photoInfo, /isAiEnabled\.value \? faces : \[\]/)
    assert.doesNotMatch(photoInfo, /aiDescription/)
    assert.match(photoInfo, /hasAiAnalysis/)
    assert.match(photoInfo, /if \(!isAiEnabled\.value\) return false/)
    assert.match(photoInfo, /v-if="hasAiAnalysis"/)
    assert.doesNotMatch(photoInfo, /aestheticScore/)
    assert.match(photoInfo, /cropUrl/)
    assert.ok(
      photoInfo.lastIndexOf("{{ $t('photo.faces') }}") >
        photoInfo.indexOf('formatedExifData.technicalParams'),
      'photo detail face section should render after the technical detail sections',
    )
    assert.match(photoInfo, /hasAiAnalysis[\s\S]*rounded-full/)
    assert.match(photoInfo, /break-words/)
    assert.doesNotMatch(
      photoInfo,
      /v-for="face in photoFaces"[\s\S]{0,220}bg-white\/\[/,
    )
    assert.doesNotMatch(
      photoInfo,
      /v-if="face\.personName"[\s\S]{0,160}truncate/,
    )
    assert.match(photoViewer, /hydrateCurrentPhotoDetails/)
    assert.match(photoViewer, /\/api\/photos\/\$\{photo\.id\}\/detail/)
    assert.match(photoViewer, /getPublicPhotoDetailEndpoint/)
    assert.match(
      photoViewer,
      /\/api\/public\/profiles\/\$\{encodeURIComponent\(publicProfileId\)\}\/photos\/\$\{encodeURIComponent\(photo\.id\)\}\/detail/,
    )
    assert.match(photoViewer, /emit\('photo-updated', response\.photo\)/)
    assert.doesNotMatch(
      photoViewer,
      /Array\.isArray\(\(photo as any\)\.photoFaces\)/,
    )
    assert.match(photoViewer, /canHydrateOwnerPhotoDetails/)
    assert.match(photoViewer, /hydratedPhotoDetailIds/)
    assert.match(photoViewer, /@photo-updated="handleInfoPanelPhotoUpdated"/)
    assert.match(photoInfo, /defineEmits/)
    assert.match(photoInfo, /canRetryAiAnalysis/)
    assert.match(photoInfo, /startAiAnalysisTaskStatusCheck/)
    assert.match(photoInfo, /\/api\/queue\/stats\/\$\{taskId\}/)
    assert.match(photoInfo, /\/api\/photos\/\$\{photoId\}\/detail/)
    assert.match(photoInfo, /emit\('photo-updated', refreshedPhoto\)/)
    assert.match(photoInfo, /v-if="canRetryAiAnalysis/)
    assert.match(
      readSource('server/api/photos/[photoId]/detail.get.ts'),
      /listFacePayloads\(\{\s*ownerUserId:\s*photo\.ownerUserId,/s,
    )
    assert.match(dashboardLayout, /dashboard\/people/)
    assert.match(peoplePage, /\/api\/people/)
    assert.match(peoplePage, /\/api\/people\/\$\{personId\}\/photos/)
    assert.match(peoplePage, /selectedPersonRoute/)
    assert.match(peoplePage, /route\.query\.person/)
    assert.match(
      peoplePage,
      /openViewer\([\s\S]*selectedPersonRoute\.value[\s\S]*selectedPhotos/,
    )
    assert.match(peoplePage, /router\.push\(`\/\$\{photo\.id\}`\)/)
    assert.doesNotMatch(peoplePage, /people\/merge/)
    assert.doesNotMatch(peoplePage, /mergeTargetId/)
    assert.doesNotMatch(peoplePage, /git-merge/)
    assert.match(peoplePage, /faceCropUrl\(person\)[\s\S]{0,220}rounded-full/)
    assert.match(peoplePage, /selectedFaces\?\.length[\s\S]*rounded-full/)
    assert.match(
      peoplePage,
      /:aria-label="\$t\('dashboard\.people\.listTitle'\)"/,
    )
    assert.match(peoplePage, /hidden lg:block/)
    assert.match(peoplePage, /lg:grid-cols-\[18rem_minmax\(0,1fr\)\]/)
    assert.match(peoplePage, /overflow-x-auto[\s\S]*lg:hidden/)
    assert.match(peoplePage, /selectedPhotosStatus/)
    assert.match(peoplePage, /selectedPhotosError/)
    assert.match(peoplePage, /refreshSelectedPhotos/)
    assert.match(peoplePage, /max-w-none/)
    assert.doesNotMatch(peoplePage, /max-w-7xl flex-col gap-6/)
    assert.doesNotMatch(
      peoplePage,
      /grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6/,
    )
    assert.match(peoplePage, /photo-face-cluster/)
    assert.match(peoplePage, /photo-ml-backfill/)
    assert.match(peoplePage, /faceCropUrl/)
    assert.match(peoplePage, /\/api\/people\/\$\{personId\}\/faces/)
    assert.match(peoplePage, /selectedPersonCoverPhoto/)
    assert.match(peoplePage, /personMasonryItems/)
    assert.match(peoplePage, /MasonryWall/)
    assert.match(peoplePage, /MasonryItem/)
    assert.doesNotMatch(peoplePage, /backdrop-blur/)
    assert.match(publicRoutes, /buildPublicPeopleRoute/)
    assert.match(publicRoutes, /buildPublicPersonRoute/)
    assert.match(masonryRoot, /peopleRoute/)
    assert.match(publicProfile, /buildPublicPeopleRoute/)
    assert.match(publicProfile, /:people-route/)
    assert.match(
      publicPeople,
      /\/api\/public\/profiles\/\$\{encodedPublicId\.value\}\/people/,
    )
    assert.match(publicPeople, /buildPublicPersonRoute/)
    assert.match(publicPeople, /person\.faceCropUrl[\s\S]*rounded-full/)
    assert.match(publicPeople, /waterfallPhotos/)
    assert.match(publicPeople, /animate-scroll-down/)
    assert.match(publicPeople, /rounded-full[\s\S]*person\.faceCropUrl/)
    assert.match(publicPeople, /break-words/)
    assert.doesNotMatch(publicPeople, /truncate text-sm font-semibold/)
    assert.match(publicPerson, /openViewer\([\s\S]*buildPublicPersonRoute/)
    assert.match(publicPerson, /MasonryWall/)
    assert.match(publicPerson, /MasonryItem/)
    assert.match(publicPerson, /coverPhoto/)
    assert.match(publicPerson, /backdrop-blur/)
    assert.match(publicPerson, /albumStats/)
    assert.doesNotMatch(
      publicPerson,
      /class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"/,
    )
    assert.match(publicPersonPhotosApi, /photoFaces/)
    assert.match(publicPersonPhotosApi, /visibility/)
    assert.match(publicPeopleApi, /homepageVisibility/)
    assert.match(publicPeopleApi, /listFacePayloads/)
    assert.match(publicPeopleApi, /visibility/)
    assert.match(publicPhotoDetailApi, /serializePublicPhoto/)
    assert.match(publicPhotoDetailApi, /aiAnalysis/)
    assert.match(publicPhotoDetailApi, /photoFaces/)
    assert.match(publicPhotoDetailApi, /person\.isHidden/)
    assert.match(publicPhotoDetailApi, /includeUnassigned:\s*isOwner/)
    assert.match(
      publicPhotoDetailApi,
      /eq\(tables\.photos\.visibility,\s*'public'\)/,
    )
  })

  it('exposes per-photo ML status and retry actions in photo management', () => {
    const endpoint = readSource('server/api/photos/index.get.ts')
    const photosPage = readSource('app/pages/dashboard/photos.vue')
    const addTask = readSource('server/api/queue/add-task.post.ts')

    assert.match(endpoint, /mlStatus/)
    assert.doesNotMatch(endpoint, /photo_auto_tags/)
    assert.match(endpoint, /hasPhotoEmbedding/)
    assert.match(endpoint, /stages/)
    assert.match(endpoint, /semantic:[\s\S]*hasEmbedding/)
    assert.match(endpoint, /description:[\s\S]*hasDescription/)
    assert.match(endpoint, /aiAnalysis =/)
    assert.doesNotMatch(endpoint, /aiDescription/)
    assert.doesNotMatch(endpoint, /aesthetic:/)
    assert.doesNotMatch(endpoint, /aestheticScore/)
    assert.match(endpoint, /autoTags:[\s\S]*autoTagCount/)
    assert.match(endpoint, /faces:[\s\S]*faceCount/)
    assert.match(endpoint, /people:[\s\S]*personCount/)
    assert.doesNotMatch(endpoint, /photo_embeddings/)
    assert.match(endpoint, /cropUrl/)
    assert.match(endpoint, /pipeline_queue/)
    assert.match(photosPage, /mlStatus/)
    assert.match(photosPage, /getMlStageVisual/)
    assert.match(photosPage, /mlStages/)
    assert.match(photosPage, /semantic/)
    assert.match(photosPage, /dashboard\.photos\.mlStatus\.semanticIndexed/)
    assert.match(photosPage, /dashboard\.photos\.mlStatus\.semanticMissing/)
    assert.doesNotMatch(
      photosPage,
      /\? \$t\('dashboard\.photos\.mlStatus\.indexed'\)[\s\S]{0,180}: \$t\('dashboard\.photos\.mlStatus\.notIndexed'\)/,
    )
    assert.match(photosPage, /handleMachineLearningAutoTagsSingle/)
    assert.match(photosPage, /handleMachineLearningSemanticSingle/)
    assert.match(photosPage, /handleAiDescriptionSingle/)
    assert.doesNotMatch(photosPage, /handleAestheticScoreSingle/)
    assert.match(photosPage, /handleFaceDetectSingle/)
    assert.match(photosPage, /dashboard\.photos\.actions\.extractAiTags/)
    assert.match(photosPage, /dashboard\.photos\.actions\.buildSemanticIndex/)
    assert.match(photosPage, /dashboard\.photos\.actions\.detectFaces/)
    assert.match(photosPage, /watchQueuedPhotoTask/)
    assert.match(photosPage, /queuedPhotoTaskIntervals/)
    assert.match(photosPage, /await refresh\(\)/)
    assert.doesNotMatch(photosPage, /handleFaceClusterSingle/)
    assert.doesNotMatch(photosPage, /dashboard\.photos\.actions\.clusterFaces/)
    assert.match(photosPage, /mlStages\.map/)
    assert.doesNotMatch(photosPage, /getMlStatusSummary/)
    assert.doesNotMatch(photosPage, /dashboard\.photos\.mlStatus\.summary/)
    assert.doesNotMatch(
      photosPage,
      /dashboard\.photos\.actions\.reprocess['"]\)/,
    )
    assert.match(addTask, /photo-ml-auto-tags/)
    assert.match(addTask, /photo-ml-semantic-embedding/)
    assert.match(addTask, /photo-ai-analysis/)
    assert.doesNotMatch(addTask, /photo-aesthetic-score/)
    assert.match(addTask, /photo-face-detect/)
    assert.match(addTask, /photo-face-cluster/)
  })

  it('adds ML task and stage labels for upload and queue displays', () => {
    for (const locale of [
      'i18n/locales/en.json',
      'i18n/locales/zh-Hans.json',
      'i18n/locales/ja.json',
      'i18n/locales/zh-Hant-HK.json',
      'i18n/locales/zh-Hant-TW.json',
    ]) {
      const source = readSource(locale)
      for (const label of [
        'photo-ml-index',
        'photo-ml-backfill',
        'photo-ml-auto-tags',
        'photo-ml-semantic-embedding',
        'photo-ai-analysis',
        'photo-face-detect',
        'photo-face-cluster',
        'ml-index',
        'ml-backfill',
        'ml-auto-tags',
        'ml-semantic-embedding',
        'ml-ai-analysis',
        'ml-ai-analysis-tags',
        'ml-ai-analysis-description',
        'ml-ai-analysis-score',
        'ml-ai-analysis-critique',
        'ml-ai-analysis-suggestions',
        'face-detection',
        'face-recognition',
        'face-cluster',
      ]) {
        assert.match(source, new RegExp(label))
      }
      assert.doesNotMatch(source, /localai-model-ensure/)
      assert.doesNotMatch(source, /photo-aesthetic-score/)
      assert.doesNotMatch(source, /ml-aesthetic-score/)
      assert.doesNotMatch(source, /aestheticScore/)
      assert.doesNotMatch(source, /视觉 API 和 LocalAI 人脸服务/)
      assert.doesNotMatch(source, /視覺 API 和 LocalAI 人臉服務/)
      assert.doesNotMatch(source, /視覺 API 同 LocalAI 人臉服務/)
      assert.doesNotMatch(source, /LocalAI face service/)
    }
  })

  it('adds a safe local data reset script that preserves AI model directories', () => {
    const scriptPath = new URL(
      '../scripts/dev/reset-local-data.sh',
      import.meta.url,
    )
    assert.equal(existsSync(scriptPath), true)

    const script = readFileSync(scriptPath, 'utf8')
    assert.match(script, /data\/ai\/models/)
    assert.match(script, /data\/ai\/localai\/models/)
    assert.match(script, /data\/ai\/localai\/backend_data/)
    assert.match(script, /data\/ai\/localai\/cache/)
    assert.match(script, /data\/ai\/qdrant/)
    assert.doesNotMatch(script, /third-party\/ai\/data/)
    assert.match(script, /PRESERVE_ML_CACHE/)
    assert.match(script, /docker compose/)
    assert.match(script, /rm -rf "\$ROOT_DIR\/data\/storage"/)
    assert.doesNotMatch(script, /immich-ml/)
  })

  it('stores AI analysis separately and uses one staged queue task for photo AI analysis', () => {
    const sqliteSchema = readSource('server/database/schema.ts')
    const postgresSchema = readSource('server/database/schema/postgres.ts')
    const sqliteMigration = readSource(
      'server/database/migrations/0000_initial.sql',
    )
    const postgresMigration = readSource(
      'server/database/migrations/postgres/0000_initial.sql',
    )
    const queueManager = readSource('server/services/pipeline-queue/manager.ts')
    const addTaskApi = readSource('server/api/queue/add-task.post.ts')
    const addTasksApi = readSource('server/api/queue/add-tasks.post.ts')
    const photoIndexer = readSource('server/services/ml/photo-indexer.ts')
    const client = readSource('server/services/ml/client.ts')
    const photosApi = readSource('server/api/photos/index.get.ts')

    for (const source of [sqliteSchema, postgresSchema]) {
      assert.match(source, /type: 'photo-ai-analysis'/)
      assert.match(source, /stages\?: PhotoAiAnalysisStage\[\]/)
      assert.match(source, /aiTags/)
      assert.match(source, /aiAnalysis/)
    }

    assert.match(sqliteMigration, /`ai_tags` text/)
    assert.match(sqliteMigration, /`ai_analysis` text/)
    assert.match(postgresMigration, /"ai_tags" jsonb/)
    assert.match(postgresMigration, /"ai_analysis" jsonb/)

    assert.match(queueManager, /enqueuePhotoAiAnalysisTask/)
    assert.match(queueManager, /type: 'photo-ai-analysis'/)
    assert.match(queueManager, /payload\.stages/)
    assert.match(queueManager, /ml-ai-analysis-/)
    assert.match(addTaskApi, /z\.literal\('photo-ai-analysis'\)/)
    assert.match(addTasksApi, /z\.literal\('photo-ai-analysis'\)/)

    assert.match(photoIndexer, /indexPhotoAiAnalysis/)
    assert.match(photoIndexer, /mergeUserAndAiTags/)
    assert.match(photoIndexer, /aiTags:/)
    assert.doesNotMatch(
      photoIndexer,
      /new Set\(\[\.\.\.\(photo\.tags \|\| \[\]\), \.\.\.scoredTags\.map/,
    )

    assert.match(client, /describePhotoForAiAnalysis/)
    assert.match(client, /scorePhotoForAiAnalysis/)
    assert.doesNotMatch(client, /score":82/)
    assert.doesNotMatch(client, /overall":82/)
    assert.match(client, /must reflect this specific image/)
    assert.match(client, /meaningful variation between photos/)
    assert.match(client, /critiquePhotoForAiAnalysis/)
    assert.match(client, /suggestPhotoImprovements/)
    assert.match(photosApi, /photo-ai-analysis/)
  })
})
