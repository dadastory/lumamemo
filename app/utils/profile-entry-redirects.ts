import {
  buildPublicAlbumsRoute,
  buildPublicGlobeRoute,
  buildPublicProfileRoute,
} from './public-profile-routes.ts'

export type LegacyProfileEntry = 'albums' | 'globe'

const normalizePublicId = (publicId: string | null | undefined) => {
  const normalized = publicId?.trim()
  return normalized || null
}

export const resolveAuthenticatedLandingRoute = (
  publicId: string | null | undefined,
) => {
  const normalized = normalizePublicId(publicId)
  return normalized ? buildPublicProfileRoute(normalized) : '/dashboard/photos'
}

export const buildLegacyProfileEntryRoute = (
  publicId: string,
  entry: LegacyProfileEntry,
) => {
  return entry === 'globe'
    ? buildPublicGlobeRoute(publicId)
    : buildPublicAlbumsRoute(publicId)
}
