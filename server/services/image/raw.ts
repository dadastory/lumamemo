import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { exiftool } from 'exiftool-vendored'
import sharp from 'sharp'

import type { StorageProvider } from '~~/server/services/storage'
import type { PhotoAssetKind } from '~~/shared/types/photo'
import { getRawPreviewStorageKey } from '~~/server/utils/raw-photo'

export const RAW_PREVIEW_CANDIDATE_TAGS = [
  'PreviewImage',
  'JpgFromRaw',
  'OtherImage',
  'ThumbnailImage',
] as const

type RawPreviewCandidate = {
  tag: (typeof RAW_PREVIEW_CANDIDATE_TAGS)[number]
  path: string
  buffer: Buffer
  width: number
  height: number
  area: number
}

const readExtractedPreviewCandidate = async (
  filePath: string,
): Promise<Omit<RawPreviewCandidate, 'tag' | 'path'> | null> => {
  const buffer = await readFile(filePath)
  const metadata = await sharp(buffer, {
    limitInputPixels: false,
  }).metadata()

  if (!metadata.width || !metadata.height) {
    return null
  }

  return {
    buffer,
    width: metadata.width,
    height: metadata.height,
    area: metadata.width * metadata.height,
  }
}

export const extractRawPreview = async ({
  rawBuffer,
  storageKey,
  photoId,
  ownerUserId,
  storageProvider,
  logger,
}: {
  rawBuffer: Buffer
  storageKey: string
  photoId: string
  ownerUserId: number
  storageProvider: StorageProvider
  logger?: Logger[keyof Logger]
}) => {
  const tempRoot = tmpdir()
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, 'cframe-raw-'))
  const rawExtension = path.extname(storageKey) || '.raw'
  const rawFile = path.join(tempDir, `original${rawExtension}`)

  try {
    await writeFile(rawFile, rawBuffer)

    const candidates: RawPreviewCandidate[] = []
    const failures: string[] = []

    for (const tag of RAW_PREVIEW_CANDIDATE_TAGS) {
      const previewFile = path.join(tempDir, `${tag}.jpg`)
      try {
        await exiftool.extractBinaryTag(tag, rawFile, previewFile)
        const candidate = await readExtractedPreviewCandidate(previewFile)
        if (!candidate) {
          failures.push(`${tag}: missing image dimensions`)
          continue
        }

        candidates.push({
          tag,
          path: previewFile,
          ...candidate,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`${tag}: ${message}`)
      }
    }

    const selected = candidates.sort((a, b) => b.area - a.area)[0]
    if (!selected) {
      throw new Error(
        `RAW preview extraction failed; no usable embedded preview found (${failures.join('; ')})`,
      )
    }

    const orientedBuffer = await sharp(selected.buffer, {
      limitInputPixels: false,
    })
      .rotate()
      .jpeg({ quality: 92 })
      .toBuffer()
    const orientedMetadata = await sharp(orientedBuffer, {
      limitInputPixels: false,
    }).metadata()

    if (!orientedMetadata.width || !orientedMetadata.height) {
      throw new Error('RAW preview is missing image dimensions after rotation')
    }

    const previewKey = getRawPreviewStorageKey(photoId, ownerUserId)
    const object = await storageProvider.create(
      previewKey,
      orientedBuffer,
      'image/jpeg',
    )

    const asset = {
      photoId,
      kind: 'embedded-preview' as PhotoAssetKind,
      storageKey: object.key,
      fileName: 'RAW embedded preview.jpg',
      mimeType: 'image/jpeg',
      fileSize: object.size ?? orientedBuffer.length,
      width: orientedMetadata.width,
      height: orientedMetadata.height,
      isPrimary: true,
    }

    logger?.info(
      `Extracted RAW preview from ${storageKey} using ${selected.tag} (${orientedMetadata.width}x${orientedMetadata.height})`,
    )

    return {
      buffer: orientedBuffer,
      storageKey: object.key,
      mimeType: 'image/jpeg',
      fileSize: object.size ?? orientedBuffer.length,
      width: orientedMetadata.width,
      height: orientedMetadata.height,
      asset,
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
