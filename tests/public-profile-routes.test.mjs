import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildPublicAlbumDetailRoute,
  buildPublicAlbumsRoute,
  buildPublicGlobeRoute,
  buildPublicPhotoRoute,
  buildPublicProfileRoute,
} from '../app/utils/public-profile-routes.ts'

describe('public profile routes', () => {
  it('builds user-scoped profile routes without leaking raw input', () => {
    assert.equal(
      buildPublicProfileRoute('p_63f5059dacf5a1bb6028d92b'),
      '/u/p_63f5059dacf5a1bb6028d92b',
    )
    assert.equal(
      buildPublicPhotoRoute('p_63f5059dacf5a1bb6028d92b', 'photo 1'),
      '/u/p_63f5059dacf5a1bb6028d92b/photo%201',
    )
    assert.equal(
      buildPublicAlbumsRoute('p_63f5059dacf5a1bb6028d92b'),
      '/u/p_63f5059dacf5a1bb6028d92b/albums',
    )
    assert.equal(
      buildPublicAlbumDetailRoute('p_63f5059dacf5a1bb6028d92b', 42),
      '/u/p_63f5059dacf5a1bb6028d92b/albums/42',
    )
    assert.equal(
      buildPublicGlobeRoute('p_63f5059dacf5a1bb6028d92b'),
      '/u/p_63f5059dacf5a1bb6028d92b/globe',
    )
  })
})
