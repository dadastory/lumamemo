import sharp from 'sharp'
import type { StorageProvider } from '~~/server/services/storage'
import type {
  PhotoImageVariantName,
  PhotoImageVariants,
} from '~~/shared/types/photo'
import { generateBlurHash } from './blurhash'
import { withRetry, RetryPresets } from '../../utils/retry'

const VARIANT_DEFINITIONS: Array<{
  name: PhotoImageVariantName
  width: number
  quality: number
}> = [
  { name: 'thumb', width: 320, quality: 78 },
  { name: 'card', width: 960, quality: 82 },
  { name: 'view', width: 2048, quality: 86 },
]

export const getPhotoVariantStorageKey = (
  photoId: string,
  ownerUserId: number,
  variant: PhotoImageVariantName,
) => `photos/users/${ownerUserId}/variants/${photoId}/${variant}.webp`

export const generateImageVariantsAndHash = async ({
  buffer,
  photoId,
  ownerUserId,
  storageProvider,
  logger,
}: {
  buffer: Buffer
  photoId: string
  ownerUserId: number
  storageProvider: StorageProvider
  logger?: Logger[keyof Logger]
}): Promise<{
  imageVariants: PhotoImageVariants
  thumbnailHash: string | null
}> => {
  return await withRetry(
    async () => {
      const imageVariants: PhotoImageVariants = {}
      let thumbBuffer: Buffer | null = null

      for (const definition of VARIANT_DEFINITIONS) {
        const { data, info } = await sharp(buffer, { limitInputPixels: false })
          .rotate()
          .resize({
            width: definition.width,
            withoutEnlargement: true,
            fastShrinkOnLoad: false,
          })
          .webp({ quality: definition.quality })
          .toBuffer({ resolveWithObject: true })

        const key = getPhotoVariantStorageKey(
          photoId,
          ownerUserId,
          definition.name,
        )
        const object = await storageProvider.create(key, data, 'image/webp')

        imageVariants[definition.name] = {
          key: object.key,
          url: storageProvider.getPublicUrl(object.key),
          width: info.width,
          height: info.height,
          size: object.size ?? data.length,
          format: 'webp',
        }

        if (definition.name === 'thumb') {
          thumbBuffer = data
        }
      }

      const thumbnailHash = thumbBuffer
        ? await generateBlurHash(thumbBuffer, logger)
        : null

      logger?.info('Successfully generated image variants')

      return { imageVariants, thumbnailHash }
    },
    {
      ...RetryPresets.standard,
      timeout: 30000,
      delayStrategy: 'linear',
    },
    logger,
  )
}
