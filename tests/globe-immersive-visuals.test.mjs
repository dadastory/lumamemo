import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readText = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('immersive globe visuals', () => {
  it('declares Three.js for the local starfield renderer', () => {
    const pkg = JSON.parse(readText('../package.json'))
    assert.ok(pkg.dependencies.three)
  })

  it('provides a client-safe adaptive Three.js starfield component', () => {
    const componentUrl = new URL(
      '../app/components/map/ThreeStarfieldBackground.vue',
      import.meta.url,
    )
    assert.equal(existsSync(componentUrl), true)

    const component = readFileSync(componentUrl, 'utf8')
    assert.match(component, /from 'three'/)
    assert.match(component, /WebGLRenderer/)
    assert.match(component, /Points/)
    assert.match(component, /prefers-reduced-motion/)
    assert.match(component, /isMobileViewport/)
    assert.match(component, /cancelAnimationFrame/)
    assert.match(component, /\.dispose\(\)/)
  })

  it('mounts only a background starfield, keeps globe projection, and preserves main branch camera behavior', () => {
    const globePage = readText('../app/pages/globe.vue')
    assert.match(globePage, /MapThreeStarfieldBackground/)
    assert.match(globePage, /class="absolute inset-0 z-0"/)
    assert.doesNotMatch(globePage, /foreground/)
    assert.doesNotMatch(globePage, /mix-blend-screen/)
    assert.match(globePage, /setProjection\?\.\(\{ type: 'globe' \}\)/)
    assert.match(globePage, /setFog\?\.\(/)
    assert.match(globePage, /setSky\?\.\(/)
    assert.doesNotMatch(globePage, /setPitch/)
    assert.doesNotMatch(globePage, /setBearing/)
    assert.doesNotMatch(globePage, /pitch:\s*\d+/)
    assert.doesNotMatch(globePage, /bearing:\s*-?\d+/)
  })

  it('keeps globe map control styles scoped to the globe page', () => {
    const globePage = readText('../app/pages/globe.vue')

    assert.match(globePage, /<style scoped>/)
    assert.doesNotMatch(globePage, /\n\.mapboxgl-ctrl-logo\s*\{/)
    assert.doesNotMatch(globePage, /\n\.mapboxgl-ctrl-attrib\s*\{/)
    assert.match(globePage, /\.globe-shell\s+:deep\(\.mapboxgl-ctrl-logo\)/)
    assert.match(globePage, /\.globe-shell\s+:deep\(\.mapboxgl-ctrl-attrib\)/)
  })

  it('remeasures masonry layout when returning from full-screen globe routes', () => {
    const masonryRoot = readText('../app/components/masonry/Root.vue')

    assert.match(masonryRoot, /const route = useRoute\(\)/)
    assert.match(masonryRoot, /remeasureMasonryLayout/)
    assert.match(masonryRoot, /watch\(\s*\[\s*masonryItems,\s*\(\) => route\.fullPath\s*\]/s)
  })
})
