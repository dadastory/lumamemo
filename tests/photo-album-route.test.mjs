import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('photo album route context', () => {
  it('stores the current viewer album route with the viewer session', () => {
    const source = readSource('app/stores/viewer.ts')

    assert.match(source, /const albumRoute = ref<string \| null>\(null\)/)
    assert.match(source, /nextAlbumRoute\?: string \| null/)
    assert.match(source, /albumRoute\.value = nextAlbumRoute \?\? null/)
    assert.match(source, /albumRoute,/)
  })

  it('passes album routes from public profile viewers into photo info panels', () => {
    const appSource = readSource('app/app.vue')
    const viewerSource = readSource('app/components/photo/Viewer.vue')

    assert.match(appSource, /albumRoute,/)
    assert.match(appSource, /:album-route=/)
    assert.equal(
      (viewerSource.match(/:album-route="albumRoute"/g) || []).length,
      2,
    )
  })

  it('opens photo album links against the current scoped album route', () => {
    const source = readSource('app/components/photo/InfoPanel.vue')

    assert.match(source, /albumRoute\?: string \| null/)
    assert.doesNotMatch(source, /window\.open\(`\/albums\/\$\{albumId\}`\)/)
    assert.match(source, /props\.albumRoute \|\| '\/albums'/)
    assert.match(source, /window\.location\.assign\(target\)/)
  })

  it('sets user-scoped album routes for public profile and public album viewer sessions', () => {
    const masonrySource = readSource('app/components/masonry/Root.vue')
    const publicProfileSource = readSource(
      'app/components/public/PublicProfileMasonry.vue',
    )
    const publicAlbumSource = readSource(
      'app/pages/u/[publicId]/albums/[albumId].vue',
    )

    assert.match(
      masonrySource,
      /openViewer\(\s*index,\s*props\.returnRoute \|\| null,\s*displayPhotos\.value as Photo\[\],\s*props\.globeRoute \|\| null,\s*props\.albumRoute \|\| null,\s*\)/s,
    )
    assert.match(
      publicProfileSource,
      /buildPublicAlbumsRoute\(props\.publicId\)/,
    )
    assert.match(publicAlbumSource, /buildPublicAlbumsRoute\(publicId\.value\)/)
  })

  it('preserves the current scoped photo list when public photo routes update an open viewer', () => {
    const publicProfileSource = readSource(
      'app/components/public/PublicProfileMasonry.vue',
    )

    assert.match(
      publicProfileSource,
      /const \{ isViewerOpen,\s*scopedPhotos \} = storeToRefs\(viewerState\)/,
    )
    assert.match(
      publicProfileSource,
      /let activePhotos =[\s\S]*isViewerOpen\.value && scopedPhotos\.value[\s\S]*\? scopedPhotos\.value[\s\S]*: currentPhotos/,
    )
    assert.match(
      publicProfileSource,
      /let foundIndex = activePhotos\.findIndex\(/,
    )
    assert.match(
      publicProfileSource,
      /foundIndex === -1 && activePhotos !== currentPhotos/,
    )
  })
})
