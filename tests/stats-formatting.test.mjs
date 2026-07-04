import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatBytes } from '../app/utils/index.ts'
import { normalizeStatsNumber } from '../server/utils/stats.ts'

describe('dashboard stats formatting', () => {
  it('formats Postgres string aggregate values as byte counts', () => {
    assert.equal(formatBytes('0'), '0 B')
    assert.equal(formatBytes('1024'), '1 KB')
  })

  it('normalizes database aggregate values to finite numbers', () => {
    assert.equal(normalizeStatsNumber('0'), 0)
    assert.equal(normalizeStatsNumber('1536'), 1536)
    assert.equal(normalizeStatsNumber(null), 0)
    assert.equal(normalizeStatsNumber(undefined), 0)
    assert.equal(normalizeStatsNumber('not-a-number'), 0)
  })
})
