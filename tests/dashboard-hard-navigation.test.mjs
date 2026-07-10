import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('dashboard hard navigation from non-dashboard pages', () => {
  it('uses a hard navigation for the masonry dashboard entry', () => {
    const source = readSource('app/components/masonry/item/Header.vue')

    assert.match(source, /const handleOpenDashboard = \(\) => \{/)
    assert.match(source, /window\.location\.assign\(props\.dashboardRoute\)/)
    assert.match(source, /@click="handleOpenDashboard"/)
    assert.doesNotMatch(source, /:to="dashboardRoute"/)
  })

  it('keeps public gallery links as client-side route entries', () => {
    const source = readSource('app/components/masonry/item/Header.vue')

    assert.match(source, /:to="albumRoute"/)
    assert.match(source, /v-if="albumRoute"/)
    assert.doesNotMatch(source, /albumRoute: '\/albums'/)
    assert.match(source, /:to="globeRoute"/)
  })

  it('uses a hard navigation after accepting an invitation', () => {
    const source = readSource('app/pages/invite/[token].vue')

    assert.match(source, /window\.location\.assign\('\/dashboard\/photos'\)/)
    assert.doesNotMatch(source, /router\.push\('\/dashboard\/photos'\)/)
  })
})
