import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_INVITE_EXPIRES_IN_DAYS,
  buildInviteUrl,
  getInvitationStatus,
  hashInvitationToken,
  normalizeInviteExpiry,
} from '../server/utils/invitations.ts'

describe('invitation utilities', () => {
  it('hashes invite tokens without returning the original token', () => {
    const token = 'plain-token'
    const hash = hashInvitationToken(token)

    assert.notEqual(hash, token)
    assert.match(hash, /^[a-f0-9]{64}$/)
    assert.equal(hashInvitationToken(token), hash)
  })

  it('defaults invitation expiry to seven days', () => {
    const now = new Date('2026-07-03T00:00:00.000Z')
    const expiry = normalizeInviteExpiry(undefined, now)

    assert.equal(DEFAULT_INVITE_EXPIRES_IN_DAYS, 7)
    assert.equal(expiry.toISOString(), '2026-07-10T00:00:00.000Z')
  })

  it('classifies invitation status', () => {
    const now = new Date('2026-07-03T00:00:00.000Z')

    assert.equal(
      getInvitationStatus({
        expiresAt: new Date('2026-07-04T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: null,
      }, now),
      'pending',
    )
    assert.equal(
      getInvitationStatus({
        expiresAt: new Date('2026-07-02T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: null,
      }, now),
      'expired',
    )
    assert.equal(
      getInvitationStatus({
        expiresAt: new Date('2026-07-04T00:00:00.000Z'),
        acceptedAt: new Date('2026-07-03T00:00:00.000Z'),
        revokedAt: null,
      }, now),
      'accepted',
    )
    assert.equal(
      getInvitationStatus({
        expiresAt: new Date('2026-07-04T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: new Date('2026-07-03T00:00:00.000Z'),
      }, now),
      'revoked',
    )
  })

  it('builds invitation links from the request origin', () => {
    assert.equal(
      buildInviteUrl('https://photos.example.com', 'abc'),
      'https://photos.example.com/invite/abc',
    )
  })
})
