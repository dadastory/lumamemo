import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  buildLegacyProfileEntryRoute,
  resolveAuthenticatedLandingRoute,
} from '../app/utils/profile-entry-redirects.ts'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('profile entry redirects', () => {
  it('sends signed-in users with a public id to their profile home', () => {
    assert.equal(
      resolveAuthenticatedLandingRoute('p_63f5059dacf5a1bb6028d92b'),
      '/u/p_63f5059dacf5a1bb6028d92b',
    )
  })

  it('keeps the dashboard photos route as the fallback without a public id', () => {
    assert.equal(resolveAuthenticatedLandingRoute(null), '/dashboard/photos')
    assert.equal(resolveAuthenticatedLandingRoute('  '), '/dashboard/photos')
  })

  it('maps legacy globe and albums entries to user-scoped routes', () => {
    assert.equal(
      buildLegacyProfileEntryRoute('p_63f5059dacf5a1bb6028d92b', 'globe'),
      '/u/p_63f5059dacf5a1bb6028d92b/globe',
    )
    assert.equal(
      buildLegacyProfileEntryRoute('p_63f5059dacf5a1bb6028d92b', 'albums'),
      '/u/p_63f5059dacf5a1bb6028d92b/albums',
    )
  })

  it('prefers the canonical profile endpoint over potentially stale session public ids', () => {
    const source = readSource('app/pages/index.vue')
    const profileFetchIndex = source.indexOf("$fetch<SessionProfile>('/api/me/profile')")
    const sessionPublicIdIndex = source.indexOf('user.value?.publicId')

    assert.notEqual(profileFetchIndex, -1)
    assert.notEqual(sessionPublicIdIndex, -1)
    assert.ok(
      profileFetchIndex < sessionPublicIdIndex,
      'the landing page should fetch the current DB profile before falling back to the session publicId',
    )
  })
})
