import { and, eq, inArray, lte, or } from 'drizzle-orm'
import { tables, useDB } from '~~/server/utils/db'
import { isStorageKeyInUserNamespace } from '~~/server/utils/security'
import { logger } from '~~/server/utils/logger'
import type { StorageProvider } from './interfaces'

const pendingUploadLogger = logger.dynamic('pending-uploads')

export const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

export type PendingUploadStatus =
  | 'uploaded'
  | 'queued'
  | 'completed'
  | 'failed'
  | 'cleaned'

type PendingUploadInput = {
  ownerUserId: number
  storageKey: string
  size: number
  contentType?: string | null
  expiresAt?: Date
}

const expiresAtFromNow = () => new Date(Date.now() + PENDING_UPLOAD_TTL_MS)

export const createPendingUpload = async ({
  ownerUserId,
  storageKey,
  size,
  contentType = null,
  expiresAt = expiresAtFromNow(),
}: PendingUploadInput) => {
  const now = new Date()
  await useDB()
    .insert(tables.pendingUploads)
    .values({
      ownerUserId,
      storageKey,
      size,
      contentType,
      status: 'uploaded',
      taskId: null,
      photoId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: tables.pendingUploads.storageKey,
      set: {
        ownerUserId,
        size,
        contentType,
        status: 'uploaded',
        taskId: null,
        photoId: null,
        errorMessage: null,
        updatedAt: now,
        expiresAt,
      },
    })
    .run()
}

export const updatePendingUploadStatus = async (
  storageKey: string,
  status: PendingUploadStatus,
  extra: {
    taskId?: number | null
    photoId?: string | null
    errorMessage?: string | null
  } = {},
) => {
  await useDB()
    .update(tables.pendingUploads)
    .set({
      status,
      updatedAt: new Date(),
      ...extra,
    })
    .where(eq(tables.pendingUploads.storageKey, storageKey))
    .run()
}

export const markPendingUploadQueued = async (
  storageKey: string,
  taskId: number,
) => {
  await updatePendingUploadStatus(storageKey, 'queued', { taskId })
}

export const markPendingUploadCompleted = async (
  storageKey: string,
  photoId: string | null = null,
) => {
  await updatePendingUploadStatus(storageKey, 'completed', {
    photoId,
    errorMessage: null,
  })
}

export const markPendingUploadFailed = async (
  storageKey: string,
  errorMessage: string,
) => {
  await updatePendingUploadStatus(storageKey, 'failed', { errorMessage })
}

export const cleanupExpiredPendingUploads = async ({
  storageProvider,
  now = new Date(),
}: {
  storageProvider: StorageProvider
  now?: Date
}) => {
  const db = useDB()
  const pendingUploads = await db
    .select()
    .from(tables.pendingUploads)
    .where(
      and(
        inArray(tables.pendingUploads.status, ['uploaded', 'queued', 'failed']),
        lte(tables.pendingUploads.expiresAt, now),
      ),
    )
    .all()

  const result = {
    scanned: pendingUploads.length,
    deletedFiles: 0,
    completedReferences: 0,
    deletedRows: 0,
    errors: [] as Array<{ storageKey: string; message: string }>,
  }

  for (const upload of pendingUploads) {
    const photo = await db
      .select()
      .from(tables.photos)
      .where(
        or(
          eq(tables.photos.storageKey, upload.storageKey),
          eq(tables.photos.displayStorageKey, upload.storageKey),
          eq(tables.photos.thumbnailKey, upload.storageKey),
          eq(tables.photos.livePhotoVideoKey, upload.storageKey),
        ),
      )
      .get()

    if (photo) {
      await markPendingUploadCompleted(upload.storageKey, photo.id)
      result.completedReferences += 1
      continue
    }

    if (!isStorageKeyInUserNamespace(upload.storageKey, upload.ownerUserId)) {
      result.errors.push({
        storageKey: upload.storageKey,
        message: 'Pending upload is outside the owner namespace',
      })
      continue
    }

    try {
      await storageProvider.delete(upload.storageKey)
      await db
        .delete(tables.pendingUploads)
        .where(eq(tables.pendingUploads.id, upload.id))
        .run()
      result.deletedFiles += 1
      result.deletedRows += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pendingUploadLogger.warn(
        `Failed to cleanup pending upload ${upload.storageKey}: ${message}`,
      )
      result.errors.push({ storageKey: upload.storageKey, message })
    }
  }

  return result
}
