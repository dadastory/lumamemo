import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canViewOwnerPrivateContent,
  normalizeHomepageVisibility,
  serializePublicProfile,
  shouldExposeAlbumToViewer,
} from '../server/utils/public-profile.ts'

describe('multi-user profile and ownership rules', () => {
  it('serializes public profiles without private identifiers', () => {
    const profile = serializePublicProfile({
      id: 42,
      email: 'alice@example.com',
      username: 'alice-private-name',
      publicId: 'p_abc123',
      displayName: 'Alice',
      profileTitle: 'Alice Photos',
      profileSlogan: 'Weekend frames',
      profileBio: 'A short public bio',
      avatar: '/avatar/alice.png',
      homepageVisibility: 'public',
    })

    assert.deepEqual(profile, {
      publicId: 'p_abc123',
      displayName: 'Alice',
      profileTitle: 'Alice Photos',
      profileSlogan: 'Weekend frames',
      profileBio: 'A short public bio',
      avatar: '/avatar/alice.png',
      homepageVisibility: 'public',
    })
    assert.equal(JSON.stringify(profile).includes('alice@example.com'), false)
    assert.equal(JSON.stringify(profile).includes('alice-private-name'), false)
    assert.equal(JSON.stringify(profile).includes('"id"'), false)
  })

  it('defaults homepage visibility to private', () => {
    assert.equal(normalizeHomepageVisibility(undefined), 'private')
    assert.equal(normalizeHomepageVisibility(null), 'private')
    assert.equal(normalizeHomepageVisibility('public'), 'public')
    assert.equal(normalizeHomepageVisibility('private'), 'private')
  })

  it('only lets the owner view private profile content', () => {
    assert.equal(canViewOwnerPrivateContent({ id: 2 }, 2), true)
    assert.equal(canViewOwnerPrivateContent({ id: 3 }, 2), false)
    assert.equal(canViewOwnerPrivateContent(null, 2), false)
    assert.equal(canViewOwnerPrivateContent({ id: 1, role: 'admin' }, 2), false)
  })

  it('shows hidden albums only to their owner', () => {
    assert.equal(shouldExposeAlbumToViewer({ isHidden: false }, null, 2), true)
    assert.equal(
      shouldExposeAlbumToViewer({ isHidden: true }, { id: 2 }, 2),
      true,
    )
    assert.equal(
      shouldExposeAlbumToViewer({ isHidden: true }, { id: 3 }, 2),
      false,
    )
    assert.equal(shouldExposeAlbumToViewer({ isHidden: true }, null, 2), false)
  })
})
