import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readProjectFile = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

describe('user storage quota', () => {
  it('keeps user quota columns in schemas and baseline migrations', () => {
    const sqliteSchema = readProjectFile('server/database/schema.ts')
    const postgresSchema = readProjectFile('server/database/schema/postgres.ts')
    const sqliteMigration = readProjectFile(
      'server/database/migrations/0000_initial.sql',
    )
    const postgresMigration = readProjectFile(
      'server/database/migrations/postgres/0000_initial.sql',
    )

    assert.match(sqliteSchema, /storageQuotaBytes: integer\('storage_quota_bytes'\)/)
    assert.match(
      postgresSchema,
      /storageQuotaBytes: bigint\('storage_quota_bytes', \{ mode: 'number' \}\)/,
    )
    assert.match(sqliteMigration, /`storage_quota_bytes` integer/)
    assert.match(postgresMigration, /"storage_quota_bytes" bigint/)
    assert.match(sqliteSchema, /pendingUploads = sqliteTable\('pending_uploads'/)
    assert.match(postgresSchema, /pendingUploads = pgTable\('pending_uploads'/)
    assert.match(sqliteMigration, /CREATE TABLE `pending_uploads`/)
    assert.match(postgresMigration, /CREATE TABLE "pending_uploads"/)
  })

  it('exposes quota controls through settings and user management', () => {
    const settings = readProjectFile('server/services/settings/contants.ts')
    const settingsUi = readProjectFile('server/services/settings/ui-config.ts')
    const systemSettingsPage = readProjectFile(
      'app/pages/dashboard/settings/system.vue',
    )
    const usersPage = readProjectFile('app/pages/dashboard/users.vue')
    const usersApi = readProjectFile('server/api/users/index.get.ts')

    assert.match(settings, /key: 'storage\.defaultUserQuotaGB'/)
    assert.match(settingsUi, /'storage\.defaultUserQuotaGB'/)
    assert.doesNotMatch(systemSettingsPage, /'storage\.defaultUserQuotaGB'/)
    assert.match(usersApi, /getUserStorageSummary/)
    assert.match(usersPage, /storage\.defaultUserQuotaGB/)
    assert.match(usersPage, /saveDefaultStorageQuota/)
    assert.match(usersPage, /storageQuotaGB/)
    assert.match(usersPage, /dashboard\.users\.table\.storage/)
  })

  it('enforces quota before every photo storage write path', () => {
    const prepareUploadApi = readProjectFile('server/api/photos/index.post.ts')
    const uploadApi = readProjectFile('server/api/photos/upload.put.ts')
    const photoUpdateApi = readProjectFile(
      'server/api/photos/[photoId]/index.put.ts',
    )
    const pipelineManager = readProjectFile(
      'server/services/pipeline-queue/manager.ts',
    )
    const rawAssetApi = readProjectFile(
      'server/api/photos/[photoId]/assets/index.post.ts',
    )
    const rawRotateApi = readProjectFile(
      'server/api/photos/[photoId]/display/rotate.post.ts',
    )

    for (const source of [
      prepareUploadApi,
      uploadApi,
      photoUpdateApi,
      pipelineManager,
      rawAssetApi,
      rawRotateApi,
    ]) {
      assert.match(source, /assertUserStorageQuota/)
    }

    assert.match(uploadApi, /additionalBytes: raw\.byteLength/)
    assert.match(rawAssetApi, /additionalBytes: buffer\.length/)
    assert.match(rawRotateApi, /replacingBytes: buffer\.length/)
    assert.match(photoUpdateApi, /additionalBytes: updatedBuffer\.length/)
    assert.match(photoUpdateApi, /replacingBytes: originalBuffer\.length/)
    assert.match(pipelineManager, /additionalBytes: updatedBuffer\.length/)
    assert.match(pipelineManager, /replacingBytes: originalBuffer\.length/)
  })

  it('uses one storage collection path for quota, deletion preview, and deletion', () => {
    const quota = readProjectFile('server/services/storage/quota.ts')
    const deletePreview = readProjectFile(
      'server/api/users/[userId]/delete-preview.get.ts',
    )
    const deleteUser = readProjectFile('server/api/users/[userId].delete.ts')

    assert.match(quota, /export const collectUserStorageEntries/)
    assert.match(quota, /listFacePayloads/)
    assert.match(deletePreview, /collectUserStorageEntries/)
    assert.match(deleteUser, /collectUserStorageEntries/)
  })

  it('tracks uploaded files until they are promoted to photos or cleaned up', () => {
    const uploadApi = readProjectFile('server/api/photos/upload.put.ts')
    const queueApi = readProjectFile('server/api/queue/add-task.post.ts')
    const manager = readProjectFile('server/services/pipeline-queue/manager.ts')
    const cleanup = readProjectFile('server/api/system/storage/cleanup-uploads.post.ts')

    assert.match(uploadApi, /createPendingUpload/)
    assert.match(queueApi, /markPendingUploadQueued/)
    assert.match(manager, /markPendingUploadCompleted/)
    assert.match(manager, /markPendingUploadFailed/)
    assert.match(cleanup, /cleanupExpiredPendingUploads/)
  })

  it('keeps user list quota summaries lightweight and validates quota settings server-side', () => {
    const usersApi = readProjectFile('server/api/users/index.get.ts')
    const settingApi = readProjectFile(
      'server/api/system/settings/[namespace]/[key].ts',
    )
    const createUserApi = readProjectFile('server/api/users/index.post.ts')
    const updateUserApi = readProjectFile('server/api/users/[userId].put.ts')

    assert.doesNotMatch(usersApi, /resolveMissingSizes:\s*true/)
    assert.match(settingApi, /validateStorageQuotaGB/)
    assert.match(createUserApi, /storageQuotaGBSchema/)
    assert.match(updateUserApi, /storageQuotaGBSchema/)
  })
})
