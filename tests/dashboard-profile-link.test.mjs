import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

import {
  buildPublicProfileRoute,
  buildPublicProfileUrl,
} from '../app/utils/public-profile-routes.ts'

const profilePage = new URL('../app/pages/dashboard/profile.vue', import.meta.url)

describe('dashboard profile public link', () => {
  it('keeps in-app navigation relative while copyable links use the browser origin', () => {
    assert.equal(
      buildPublicProfileRoute('p_aaebd2d6acb06b037d17f233'),
      '/u/p_aaebd2d6acb06b037d17f233',
    )
    assert.equal(
      buildPublicProfileUrl(
        'http://localhost:3000/',
        'p_aaebd2d6acb06b037d17f233',
      ),
      'http://localhost:3000/u/p_aaebd2d6acb06b037d17f233',
    )
  })

  it('does not navigate to the server-side request origin from the profile page', () => {
    const source = readFileSync(profilePage, 'utf8')

    assert.doesNotMatch(source, /useRequestURL\(/)
    assert.match(source, /const publicRoute = computed/)
    assert.match(source, /:to="isHomepagePublic \? publicRoute : undefined"/)
  })
})
