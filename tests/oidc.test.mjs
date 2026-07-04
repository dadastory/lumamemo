import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildOidcAuthorizationUrl,
  normalizeOidcProfile,
} from '../server/utils/oidc.ts'

describe('oidc utilities', () => {
  it('normalizes standard OIDC claims into local user fields', () => {
    assert.deepEqual(
      normalizeOidcProfile({
        sub: 'subject-1',
        email: 'ALICE@EXAMPLE.COM',
        name: 'Alice Example',
        preferred_username: 'alice',
        picture: 'https://example.com/alice.png',
      }),
      {
        subject: 'subject-1',
        email: 'alice@example.com',
        username: 'alice',
        avatar: 'https://example.com/alice.png',
      },
    )
  })

  it('builds authorization URLs with pkce and state', () => {
    const url = buildOidcAuthorizationUrl({
      authorizationEndpoint: 'https://idp.example.com/authorize',
      clientId: 'client-id',
      redirectUri: 'https://photos.example.com/api/auth/oidc/callback',
      scope: 'openid email profile',
      state: 'state-1',
      codeChallenge: 'challenge-1',
    })

    assert.equal(url.origin, 'https://idp.example.com')
    assert.equal(url.pathname, '/authorize')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('client_id'), 'client-id')
    assert.equal(url.searchParams.get('scope'), 'openid email profile')
    assert.equal(url.searchParams.get('state'), 'state-1')
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(url.searchParams.get('code_challenge'), 'challenge-1')
  })
})
