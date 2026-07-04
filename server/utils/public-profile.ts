type AnyRecord = Record<string, any>

export type HomepageVisibility = 'private' | 'public'

export const normalizeHomepageVisibility = (
  visibility: unknown,
): HomepageVisibility => (visibility === 'public' ? 'public' : 'private')

export const serializePublicProfile = (user: AnyRecord) => ({
  publicId: user.publicId,
  displayName: user.displayName || user.username,
  profileTitle: user.profileTitle || user.displayName || user.username,
  profileSlogan: user.profileSlogan ?? null,
  profileBio: user.profileBio ?? null,
  avatar: user.avatar ?? null,
  homepageVisibility: normalizeHomepageVisibility(user.homepageVisibility),
})

export const canViewOwnerPrivateContent = (
  viewer: AnyRecord | null | undefined,
  ownerUserId: number | string | null | undefined,
) => Boolean(viewer?.id != null && Number(viewer.id) === Number(ownerUserId))

export const shouldExposeAlbumToViewer = (
  album: AnyRecord | null | undefined,
  viewer: AnyRecord | null | undefined,
  ownerUserId: number | string | null | undefined,
) =>
  Boolean(
    album &&
    (!album.isHidden || canViewOwnerPrivateContent(viewer, ownerUserId)),
  )
