import { useStorageProvider } from '~~/server/utils/useStorageProvider'
import { logger } from '~~/server/utils/logger'
import { settingsManager } from '~~/server/services/settings/settingsManager'
import { assertUserStorageQuota } from '~~/server/services/storage/quota'
import { createPendingUpload } from '~~/server/services/storage/pending-uploads'
import { normalizeStorageKey } from '~~/server/utils/storage-key'
import { eq } from 'drizzle-orm'
import {
  isSupportedRawUpload,
  normalizeUploadContentType,
} from '~~/shared/utils/raw-photo'

export default eventHandler(async (event) => {
  const session = await requireActiveUserSession(event)

  const { storageProvider } = useStorageProvider(event)
  const key = getQuery(event).key as string | undefined
  const t = await useTranslation(event)

  if (!key) {
    throw createError({
      statusCode: 400,
      statusMessage: t('upload.error.required.title'),
      data: {
        title: t('upload.error.required.title'),
        message: t('upload.error.required.message', { field: 'key' }),
      },
    })
  }

  const storageKey = normalizeStorageKey(key)
  if (!storageKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid storage key',
    })
  }

  if (!isStorageKeyInUserNamespace(storageKey, session.user.id)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cannot upload to another user namespace',
    })
  }

  const contentType = normalizeUploadContentType(
    getHeader(event, 'content-type') || 'application/octet-stream',
  )
  const isAllowedRawUpload = isSupportedRawUpload(storageKey, contentType)

  // MIME 类型白名单验证（可通过环境变量配置）
  const config = useRuntimeConfig(event)
  const whitelistEnabled = config.upload.mime.whitelistEnabled

  if (whitelistEnabled) {
    const whitelistStr = config.upload.mime.whitelist
    const allowedTypes = whitelistStr
      ? whitelistStr
          .split(',')
          .map((type: string) => normalizeUploadContentType(type))
          .filter(Boolean)
      : []

    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(contentType) &&
      !isAllowedRawUpload
    ) {
      throw createError({
        statusCode: 415,
        statusMessage: t('upload.error.invalidType.title'),
        data: {
          title: t('upload.error.invalidType.title'),
          message: t('upload.error.invalidType.message', { type: contentType }),
          suggestion: t('upload.error.invalidType.suggestion', {
            allowed: allowedTypes.join(', '),
          }),
        },
      })
    }
  }

  // 使用流式处理而不是一次性读取整个文件到内存
  const raw = await readRawBody(event, false)
  if (!raw || !(raw instanceof Buffer)) {
    throw createError({
      statusCode: 400,
      statusMessage: t('upload.error.uploadFailed.title'),
      data: {
        title: t('upload.error.uploadFailed.title'),
        message: t('upload.error.uploadFailed.message'),
      },
    })
  }

  // 简单大小限制，从系统设置读取；设置缺失时使用后端默认值。
  const maxFileSizeMB =
    (await settingsManager.get<number>('system', 'upload.maxFileSize')) ?? 256
  const maxBytes = maxFileSizeMB * 1024 * 1024
  if (raw.byteLength > maxBytes) {
    const sizeInMB = (raw.byteLength / 1024 / 1024).toFixed(2)
    throw createError({
      statusCode: 413,
      statusMessage: t('upload.error.tooLarge.title'),
      data: {
        title: t('upload.error.tooLarge.title'),
        message: t('upload.error.tooLarge.message', { size: sizeInMB }),
        suggestion: t('upload.error.tooLarge.suggestion', {
          maxSize: maxFileSizeMB,
        }),
      },
    })
  }

  const user = await useDB()
    .select()
    .from(tables.users)
    .where(eq(tables.users.id, session.user.id))
    .get()

  if (user) {
    const existingMeta = await storageProvider
      .getFileMeta(storageKey)
      .catch(() => null)
    await assertUserStorageQuota(user, {
      additionalBytes: raw.byteLength,
      replacingBytes: existingMeta?.size ?? 0,
      storageProvider,
      resolveMissingSizes: true,
    })
  }

  let uploaded = false
  try {
    await storageProvider.create(storageKey, raw, contentType)
    uploaded = true
    await createPendingUpload({
      ownerUserId: session.user.id,
      storageKey,
      size: raw.byteLength,
      contentType,
    })
  } catch (error) {
    if (uploaded) {
      await storageProvider.delete(storageKey).catch((deleteError) => {
        logger.chrono.warn(
          `Failed to delete uploaded object after pending upload registration failed: ${
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError)
          }`,
        )
      })
    }
    logger.chrono.error('Storage provider create error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: t('upload.error.uploadFailed.title'),
      data: {
        title: t('upload.error.uploadFailed.title'),
        message: t('upload.error.uploadFailed.message'),
      },
    })
  }

  return { ok: true, key: storageKey }
})
