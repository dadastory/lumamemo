import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { formatPhotoLocation } from '../app/utils/photo-location.ts'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('photo location display formatting', () => {
  it('prefers the full reverse-geocoded location name', () => {
    assert.equal(
      formatPhotoLocation({
        locationName: '新阁社区, 梅林街道, 福田区, 深圳市, 广东省, 518000, 中国',
        city: '福田区',
        country: '中国',
      }),
      '新阁社区, 梅林街道, 福田区, 深圳市, 广东省, 518000, 中国',
    )
  })

  it('falls back to city and country when the detailed location is missing', () => {
    assert.equal(
      formatPhotoLocation({
        city: '福田区',
        country: '中国',
      }),
      '福田区, 中国',
    )
  })

  it('returns an empty string without location fields', () => {
    assert.equal(formatPhotoLocation({}), '')
  })

  it('uses the shared formatter in key photo display surfaces', () => {
    for (const path of [
      'app/pages/dashboard/photos.vue',
      'app/components/photo/InfoPanel.vue',
      'app/components/map/PhotoPin.vue',
      'app/components/masonry/item/Photo.vue',
    ]) {
      const source = readSource(path)

      assert.match(source, /formatPhotoLocation/)
    }
  })

  it('constrains long location labels in map popovers', () => {
    const photoPin = readSource('app/components/map/PhotoPin.vue')
    const clusterPin = readSource('app/components/map/ClusterPin.vue')

    assert.match(
      photoPin,
      /class="flex min-w-0 items-center gap-1 text-xs text-neutral-600 dark:text-muted font-medium mb-2"/,
    )
    assert.match(photoPin, /class="min-w-0 flex-1"/)
    assert.match(photoPin, /class="block truncate"/)
    assert.match(photoPin, /class="shrink-0"/)
    assert.match(photoPin, /class="shrink-0 whitespace-nowrap"/)

    assert.match(
      clusterPin,
      /class="flex min-w-0 items-center gap-1 text-xs text-neutral-600 dark:text-muted font-medium mt-2"/,
    )
    assert.match(clusterPin, /class="size-4 shrink-0"/)
    assert.match(clusterPin, /class="min-w-0 flex-1 truncate"/)
  })

  it('constrains long location labels in gallery and filter surfaces', () => {
    const masonryPhoto = readSource('app/components/masonry/item/Photo.vue')
    const filterPanel = readSource('app/components/overlay/FilterPanel.vue')
    const dashboardPhotos = readSource('app/pages/dashboard/photos.vue')

    assert.match(
      masonryPhoto,
      /class="flex min-w-0 items-center gap-1 text-xs font-medium opacity-80"/,
    )
    assert.match(masonryPhoto, /class="shrink-0 whitespace-nowrap"/)
    assert.match(masonryPhoto, /class="min-w-0 flex-1 truncate"/)

    assert.match(filterPanel, /class="min-w-0 flex-1 text-sm text-default font-medium truncate"/)
    assert.match(filterPanel, /class="size-4 shrink-0 text-green-500"/)

    assert.match(dashboardPhotos, /max-w-\[18rem\] truncate/)
    assert.doesNotMatch(
      dashboardPhotos,
      /class: location \? 'text-xs' : 'text-neutral-400 text-xs'/,
    )
  })
})
