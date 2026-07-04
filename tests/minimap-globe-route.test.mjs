import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('photo minimap globe route', () => {
  it('stores the current viewer globe route with the viewer session', () => {
    const source = readSource('app/stores/viewer.ts')

    assert.match(source, /const globeRoute = ref<string \| null>\(null\)/)
    assert.match(source, /nextGlobeRoute\?: string \| null/)
    assert.match(source, /globeRoute\.value = nextGlobeRoute \?\? null/)
    assert.match(source, /globeRoute,/)
  })

  it('passes the viewer globe route into the photo info panel', () => {
    const appSource = readSource('app/app.vue')
    const viewerSource = readSource('app/components/photo/Viewer.vue')

    assert.match(appSource, /globeRoute,/)
    assert.match(appSource, /:globe-route="globeRoute"/)
    assert.match(viewerSource, /globeRoute\?: string \| null/)
    assert.equal(
      (viewerSource.match(/:globe-route="globeRoute"/g) || []).length,
      2,
    )
  })

  it('opens minimaps against the current scoped globe route before falling back to the legacy entry', () => {
    const source = readSource('app/components/photo/InfoPanel.vue')

    assert.match(source, /globeRoute\?: string \| null/)
    assert.doesNotMatch(source, /window\.open\(`\/globe\?photoId=\$\{photoId\}`\)/)
    assert.match(source, /props\.globeRoute \|\| '\/globe'/)
    assert.match(source, /new URLSearchParams\(\{ photoId \}\)/)
  })

  it('sets user-scoped globe routes for public profile and public album viewer sessions', () => {
    const masonrySource = readSource('app/components/masonry/Root.vue')
    const publicProfileSource = readSource(
      'app/components/public/PublicProfileMasonry.vue',
    )
    const publicAlbumSource = readSource('app/pages/u/[publicId]/albums/[albumId].vue')

    assert.match(
      masonrySource,
      /openViewer\(\s*index,\s*props\.returnRoute \|\| null,\s*displayPhotos\.value as Photo\[\],\s*props\.globeRoute \|\| null,\s*\)/s,
    )
    assert.match(
      publicProfileSource,
      /openViewer\(\s*foundIndex,\s*profileRoute\.value,\s*currentPhotos as Photo\[\],\s*buildPublicGlobeRoute\(props\.publicId\),\s*\)/s,
    )
    assert.match(publicAlbumSource, /buildPublicGlobeRoute\(publicId\.value\)/)
  })
})
