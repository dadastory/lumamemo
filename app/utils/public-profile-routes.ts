const encodeSegment = (value: string | number) =>
  encodeURIComponent(String(value).trim())

export const buildPublicProfileRoute = (publicId: string) =>
  `/u/${encodeSegment(publicId)}`

export const buildPublicProfileUrl = (origin: string, publicId: string) =>
  `${origin.replace(/\/+$/, '')}${buildPublicProfileRoute(publicId)}`

export const buildPublicPhotoRoute = (publicId: string, photoId: string) =>
  `${buildPublicProfileRoute(publicId)}/${encodeSegment(photoId)}`

export const buildPublicAlbumsRoute = (publicId: string) =>
  `${buildPublicProfileRoute(publicId)}/albums`

export const buildPublicAlbumDetailRoute = (
  publicId: string,
  albumId: string | number,
) => `${buildPublicAlbumsRoute(publicId)}/${encodeSegment(albumId)}`

export const buildPublicGlobeRoute = (publicId: string) =>
  `${buildPublicProfileRoute(publicId)}/globe`
