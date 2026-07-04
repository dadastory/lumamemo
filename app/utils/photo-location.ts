type PhotoLocationInput = {
  locationName?: string | null
  city?: string | null
  country?: string | null
}

export const formatPhotoLocation = (
  photo: PhotoLocationInput | null | undefined,
): string => {
  if (!photo) return ''

  const detailedLocation = photo.locationName?.trim()
  if (detailedLocation) return detailedLocation

  return [photo.city, photo.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ')
}
