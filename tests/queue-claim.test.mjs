import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('queue task claiming', () => {
  it('claims pending tasks atomically so workers cannot process the same task', () => {
    const manager = readSource('server/services/pipeline-queue/manager.ts')
    const getNextTask = manager.match(
      /async getNextTask\(\): Promise<PipelineQueueItem \| null> \{([\s\S]*?)\n  \}/,
    )?.[1]

    assert.ok(getNextTask, 'getNextTask should exist')
    assert.match(getNextTask, /update\(tables\.pipelineQueue\)/)
    assert.match(getNextTask, /and\(/)
    assert.match(getNextTask, /eq\(tables\.pipelineQueue\.id, task\.id\)/)
    assert.match(
      getNextTask,
      /eq\(tables\.pipelineQueue\.status,\s*'pending'\)/,
    )
    assert.match(
      getNextTask,
      /returning\(\{ id: tables\.pipelineQueue\.id \}\)/,
    )
    assert.match(getNextTask, /claimedTask/)
    assert.match(getNextTask, /if \(!claimedTask\) return null/)
  })
})
