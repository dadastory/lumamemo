export type PhotoImageVariantName = 'thumb' | 'card' | 'view'

type PhotoImageVariant = {
  url?: string | null
  width?: number | null
}

type PhotoImageVariantInput = {
  imageVariants?: Partial<
    Record<PhotoImageVariantName, PhotoImageVariant>
  > | null
  thumbnailUrl?: string | null
  originalUrl?: string | null
}

const VARIANT_ORDER: PhotoImageVariantName[] = ['thumb', 'card', 'view']
const ANIMATED_ORIGINAL_EXTENSIONS = new Set(['gif'])

const getPathExtension = (url: string | null | undefined) => {
  if (!url) return ''
  const [path] = url.split(/[?#]/)
  const extension = path?.split('.').pop()?.toLowerCase()
  return extension || ''
}

export const isAnimatedImageUrl = (url: string | null | undefined) => {
  return ANIMATED_ORIGINAL_EXTENSIONS.has(getPathExtension(url))
}

export const hasAnimatedOriginal = (
  photo: PhotoImageVariantInput | null | undefined,
) => {
  return isAnimatedImageUrl(photo?.originalUrl)
}

export const getPhotoVariantUrl = (
  photo: PhotoImageVariantInput | null | undefined,
  variant: PhotoImageVariantName,
) => {
  if (!photo) return ''

  const variantUrl = photo.imageVariants?.[variant]?.url
  if (variantUrl) return variantUrl

  return photo.thumbnailUrl || photo.originalUrl || ''
}

export const getPhotoDisplayUrl = (
  photo: PhotoImageVariantInput | null | undefined,
) => {
  if (!photo) return ''
  if (hasAnimatedOriginal(photo)) return photo.originalUrl || ''
  return getPhotoVariantUrl(photo, 'view')
}

export const getPhotoVariantSrcset = (
  photo: PhotoImageVariantInput | null | undefined,
) => {
  if (!photo?.imageVariants) return ''

  return VARIANT_ORDER.map((variant) => {
    const item = photo.imageVariants?.[variant]
    if (!item?.url || !item.width) return null
    return `${item.url} ${item.width}w`
  })
    .filter(Boolean)
    .join(', ')
}
