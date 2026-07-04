import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('queue task deletion wiring', () => {
  it('provides a task-scoped delete endpoint with non-active status guards', () => {
    const source = readSource('server/api/queue/task/[taskId].delete.ts')

    assert.match(source, /requireAdminSession\(event\)/)
    assert.match(source, /getValidatedRouterParams/)
    assert.match(source, /Task not found/)
    assert.match(source, /completed/)
    assert.match(source, /failed/)
    assert.match(source, /pending/)
    assert.match(source, /in-stages/)
    assert.match(source, /delete\(tables\.pipelineQueue\)/)
  })

  it('routes the dashboard delete action to the current task endpoint', () => {
    const source = readSource('app/pages/dashboard/queue.vue')

    assert.match(source, /\/api\/queue\/task\/\$\{taskId\}/)
    assert.doesNotMatch(source, /\/api\/queue\/failed\//)
  })

  it('only shows row delete actions for completed or failed tasks', () => {
    const source = readSource('app/pages/dashboard/queue.vue')

    assert.match(
      source,
      /row\.original\.status === 'completed' \|\|[\s\S]*row\.original\.status === 'failed'/,
    )
    assert.doesNotMatch(source, /row\.original\.status !== 'in-stage'/)
  })

  it('uses a distinct empty-clear message when no non-active tasks are deleted', () => {
    const source = readSource('app/pages/dashboard/queue.vue')

    assert.match(source, /result\.deletedCount > 0/)
    assert.match(source, /clearEmpty/)
  })
})
