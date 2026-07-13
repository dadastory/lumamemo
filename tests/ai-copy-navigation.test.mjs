import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readProjectFile = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

describe('AI copy and face album navigation', () => {
  it('shows the face album navigation only when AI and face albums are enabled', () => {
    const dashboardLayout = readProjectFile('app/layouts/dashboard.vue')

    assert.match(dashboardLayout, /useSettingRef\('system:ml\.enabled'\)/)
    assert.match(
      dashboardLayout,
      /useSettingRef\('system:ml\.faceAlbum\.enabled'\)/,
    )
    assert.match(dashboardLayout, /const showPeopleNav = computed/)
    assert.match(dashboardLayout, /isTruthySetting\(mlEnabled\.value\)/)
    assert.match(dashboardLayout, /isTruthySetting\(faceAlbumEnabled\.value\)/)
    assert.match(dashboardLayout, /\.\.\.\(showPeopleNav\.value/)
  })

  it('uses AI feature wording instead of machine learning wording in visible settings copy', () => {
    const zhHans = readProjectFile('i18n/locales/zh-Hans.json')
    const en = readProjectFile('i18n/locales/en.json')

    assert.doesNotMatch(zhHans, /启用机器学习/)
    assert.doesNotMatch(zhHans, /使用 LumaMemo AI 服务生成自动标签/)
    assert.match(zhHans, /启用 AI 能力/)
    assert.match(zhHans, /使用大模型、向量检索和人脸识别服务/)

    assert.doesNotMatch(en, /Enable machine learning/)
    assert.doesNotMatch(en, /Use LumaMemo AI services/)
    assert.match(en, /Enable AI features/)
    assert.match(en, /Use vision models, vector search, and face recognition services/)
  })
})
