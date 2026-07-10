import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('photo tag layout', () => {
  it('keeps masonry card tags compact and horizontal on narrow cards', () => {
    const source = readSource('app/components/photo/TagOverflowList.vue')
    const cardSource = readSource('app/components/masonry/item/Photo.vue')

    assert.match(cardSource, /PhotoTagOverflowList/)
    assert.doesNotMatch(cardSource, /slice\(0,\s*3\)/)
    assert.match(source, /ResizeObserver/)
    assert.match(source, /visibleCount/)
    assert.match(source, /hiddenCount/)
    assert.match(source, /max-w-full/)
    assert.match(source, /overflow-hidden/)
    assert.match(source, /whitespace-nowrap/)
    assert.match(source, /truncate/)
    assert.match(source, /\+{{ hiddenCount }}/)
  })

  it('lets detail tags wrap without collapsing long labels into vertical strips', () => {
    const source = readSource('app/components/photo/InfoPanel.vue')

    assert.match(source, /flex flex-wrap/)
    assert.match(source, /max-w-full/)
    assert.match(source, /truncate/)
    assert.match(source, /:title="tag"/)
  })
})
