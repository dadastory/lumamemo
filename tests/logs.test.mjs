import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  clampInitialLines,
  DEFAULT_INITIAL_LINES,
  MAX_INITIAL_LINES,
} from '../server/utils/log-stream.ts'
import { highlightLogSearch } from '../app/utils/log-highlight.ts'

describe('log stream options', () => {
  it('defaults to a lightweight recent window', () => {
    assert.equal(DEFAULT_INITIAL_LINES, 500)
    assert.equal(clampInitialLines(undefined), 500)
    assert.equal(clampInitialLines('all'), 500)
  })

  it('clamps requested history to the maximum lightweight window', () => {
    assert.equal(MAX_INITIAL_LINES, 2000)
    assert.equal(clampInitialLines('5000'), 2000)
    assert.equal(clampInitialLines('-1'), 0)
  })

  it('escapes log content before highlighting search terms', () => {
    assert.equal(
      highlightLogSearch('<img src=x onerror=alert(1)> upload failed', 'upload'),
      '&lt;img src=x onerror=alert(1)&gt; <mark class="bg-yellow-300 dark:bg-yellow-700 text-black dark:text-white rounded">upload</mark> failed',
    )
  })

  it('highlights search terms with regular expression characters', () => {
    assert.equal(
      highlightLogSearch('request /api/photos?id=1 failed', '/api/photos?id=1'),
      'request <mark class="bg-yellow-300 dark:bg-yellow-700 text-black dark:text-white rounded">/api/photos?id=1</mark> failed',
    )
  })
})
