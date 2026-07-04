import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { formatPhotoLocation } from '../app/utils/photo-location.ts'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const readJson = (path) => JSON.parse(readSource(path))

describe('photo location filters', () => {
  it('can derive a filter label from locationName without city', () => {
    assert.equal(
      formatPhotoLocation({
        locationName: '新阁社区, 梅林街道, 福田区, 深圳市, 广东省, 518000, 中国',
        city: null,
        country: '中国',
      }),
      '新阁社区, 梅林街道, 福田区, 深圳市, 广东省, 518000, 中国',
    )
  })

  it('uses formatted photo location for location filter stats and matching', () => {
    const source = readSource('app/composables/usePhotoFilters.ts')

    assert.match(source, /formatPhotoLocation/)
    assert.match(source, /const photoLocation = formatPhotoLocation\(photo\)/)
    assert.match(source, /stats\.cities\.set\(\s*photoLocation/)
    assert.match(
      source,
      /activeFilters\.value\.cities\.includes\(photoLocation\)/,
    )
    assert.doesNotMatch(source, /stats\.cities\.set\(photo\.city/)
    assert.doesNotMatch(
      source,
      /activeFilters\.value\.cities\.includes\(photo\.city\)/,
    )
  })

  it('labels the location filter as location instead of city', () => {
    const zhHans = readJson('i18n/locales/zh-Hans.json')
    const en = readJson('i18n/locales/en.json')
    const ja = readJson('i18n/locales/ja.json')
    const zhHantHk = readJson('i18n/locales/zh-Hant-HK.json')
    const zhHantTw = readJson('i18n/locales/zh-Hant-TW.json')

    assert.equal(zhHans.ui.action.filter.tabs.cities, '位置')
    assert.equal(zhHans.ui.action.filter.empty.cities, '没有位置信息')
    assert.equal(en.ui.action.filter.tabs.cities, 'Locations')
    assert.equal(en.ui.action.filter.empty.cities, 'No location information')
    assert.equal(ja.ui.action.filter.tabs.cities, '場所')
    assert.equal(ja.ui.action.filter.empty.cities, '位置情報なし')
    assert.equal(zhHantHk.ui.action.filter.tabs.cities, '位置')
    assert.equal(zhHantHk.ui.action.filter.empty.cities, '沒有位置資訊')
    assert.equal(zhHantTw.ui.action.filter.tabs.cities, '位置')
    assert.equal(zhHantTw.ui.action.filter.empty.cities, '沒有位置資訊')
  })
})
