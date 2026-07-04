import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  getPhotoDisplayUrl,
  getPhotoVariantUrl,
  getPhotoVariantSrcset,
  hasAnimatedOriginal,
} from '../app/utils/photo-image-variants.ts'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('photo image variants', () => {
  const photo = {
    id: 'photo-1',
    originalUrl: '/image/photos/users/1/original.jpg',
    thumbnailUrl: '/image/photos/users/1/legacy-thumb.webp',
    imageVariants: {
      thumb: {
        url: '/image/photos/users/1/variants/photo-1/thumb.webp',
        width: 320,
        height: 240,
        size: 12000,
        format: 'webp',
      },
      card: {
        url: '/image/photos/users/1/variants/photo-1/card.webp',
        width: 960,
        height: 720,
        size: 64000,
        format: 'webp',
      },
      view: {
        url: '/image/photos/users/1/variants/photo-1/view.webp',
        width: 2048,
        height: 1536,
        size: 220000,
        format: 'webp',
      },
    },
  }

  it('selects the requested variant before legacy thumbnails or originals', () => {
    assert.equal(
      getPhotoVariantUrl(photo, 'thumb'),
      '/image/photos/users/1/variants/photo-1/thumb.webp',
    )
    assert.equal(
      getPhotoVariantUrl(photo, 'card'),
      '/image/photos/users/1/variants/photo-1/card.webp',
    )
    assert.equal(
      getPhotoVariantUrl(photo, 'view'),
      '/image/photos/users/1/variants/photo-1/view.webp',
    )
  })

  it('falls back from missing variants to thumbnail and original urls', () => {
    assert.equal(
      getPhotoVariantUrl(
        { thumbnailUrl: '/thumb.webp', originalUrl: '/original.jpg' },
        'view',
      ),
      '/thumb.webp',
    )
    assert.equal(
      getPhotoVariantUrl({ originalUrl: '/original.jpg' }, 'card'),
      '/original.jpg',
    )
    assert.equal(getPhotoVariantUrl({}, 'thumb'), '')
  })

  it('builds responsive srcset from available variants', () => {
    assert.equal(
      getPhotoVariantSrcset(photo),
      [
        '/image/photos/users/1/variants/photo-1/thumb.webp 320w',
        '/image/photos/users/1/variants/photo-1/card.webp 960w',
        '/image/photos/users/1/variants/photo-1/view.webp 2048w',
      ].join(', '),
    )
  })

  it('keeps animated GIF originals for the detail viewer', () => {
    const animatedGif = {
      ...photo,
      originalUrl: '/image/photos/users/1/animation.GIF?download=1',
    }

    assert.equal(hasAnimatedOriginal(animatedGif), true)
    assert.equal(
      getPhotoDisplayUrl(animatedGif),
      '/image/photos/users/1/animation.GIF?download=1',
    )
    assert.equal(
      getPhotoDisplayUrl(photo),
      '/image/photos/users/1/variants/photo-1/view.webp',
    )
  })

  it('uses generated variants in key photo surfaces', () => {
    const masonryPhoto = readSource('app/components/masonry/item/Photo.vue')
    const viewer = readSource('app/components/photo/Viewer.vue')
    const clustering = readSource('app/utils/clustering.ts')
    const dashboardPhotos = readSource('app/pages/dashboard/photos.vue')

    assert.match(masonryPhoto, /getPhotoVariantUrl\(photo,\s*'card'\)/)
    assert.match(viewer, /getPhotoDisplayUrl\(photo\)/)
    assert.match(viewer, /getPhotoVariantUrl\(photo,\s*'card'\)/)
    assert.match(clustering, /getPhotoVariantUrl\(photo,\s*'thumb'\)/)
    assert.match(
      dashboardPhotos,
      /getPhotoVariantUrl\(row\.original,\s*'thumb'\)/,
    )
  })

  it('renders animated detail images without the WebGL static-frame path', () => {
    const progressiveImage = readSource(
      'app/components/photo/ProgressiveImage.vue',
    )
    const viewer = readSource('app/components/photo/Viewer.vue')

    assert.match(progressiveImage, /isAnimatedSource/)
    assert.match(progressiveImage, /showNativeAnimatedImage/)
    assert.match(progressiveImage, /v-if="showNativeAnimatedImage"/)
    assert.match(progressiveImage, /v-if="showWebGLViewer"/)
    assert.match(
      progressiveImage,
      /showWebGLViewer[\s\S]*!isAnimatedSource\.value/,
    )
    assert.match(viewer, /:src="getPhotoDisplayUrl\(photo\)"/)
  })

  it('preserves Live Photo video playback while changing still-image variants', () => {
    const viewer = readSource('app/components/photo/Viewer.vue')
    const masonryPhoto = readSource('app/components/masonry/item/Photo.vue')

    assert.match(viewer, /:is-live-photo="photo\.isLivePhoto === 1"/)
    assert.match(viewer, /photo\.livePhotoVideoUrl \|\| undefined/)
    assert.match(viewer, /<motion\.video[\s\S]*livePhotoVideoBlobUrl/)
    assert.match(masonryPhoto, /v-if="photo\.isLivePhoto && videoBlobUrl"/)
    assert.match(masonryPhoto, /PhotoLivePhotoIndicator/)
  })

  it('adds a dedicated logged-in original download endpoint and viewer action', () => {
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/original.get.ts',
          import.meta.url,
        ),
      ),
      true,
    )

    const route = readSource('server/api/photos/[photoId]/original.get.ts')
    assert.match(route, /requireActiveUserSession\(event\)/)
    assert.match(route, /authorizeOriginalPhotoDownload/)
    assert.match(route, /Content-Disposition/)

    const shareModal = readSource('app/components/photo/ShareModal.vue')
    const viewer = readSource('app/components/photo/Viewer.vue')
    assert.doesNotMatch(shareModal, /downloadOriginalImage/)
    assert.doesNotMatch(shareModal, /downloadOriginalImage'\)/)
    assert.match(viewer, /const \{ loggedIn \} = useUserSession\(\)/)
    assert.match(viewer, /const downloadOriginalImage = async \(\) =>/)
    assert.match(
      viewer,
      /\/api\/photos\/\$\{currentPhoto\.value\.id\}\/original/,
    )
    assert.match(viewer, /if \(!response\.ok\)/)
    assert.match(
      viewer,
      /<GlassButton[\s\S]*v-if="loggedIn"[\s\S]*icon="tabler:download"[\s\S]*@click="downloadOriginalImage"/,
    )
  })

  it('keeps photo details focused and exposes normal share separately', () => {
    const infoPanel = readSource('app/components/photo/InfoPanel.vue')
    const viewer = readSource('app/components/photo/Viewer.vue')

    assert.doesNotMatch(infoPanel, /useUserSession\(\)/)
    assert.doesNotMatch(infoPanel, /downloadOriginalImage/)
    assert.doesNotMatch(
      infoPanel,
      /\/api\/photos\/\$\{props\.currentPhoto\.id\}\/original/,
    )
    assert.doesNotMatch(infoPanel, /variantStatusItems/)
    assert.doesNotMatch(infoPanel, /currentPhoto\.imageVariants\?\.thumb/)
    assert.doesNotMatch(infoPanel, /currentPhoto\.imageVariants\?\.card/)
    assert.doesNotMatch(infoPanel, /currentPhoto\.imageVariants\?\.view/)
    assert.match(infoPanel, /getPhotoVariantUrl\(currentPhoto,\s*'card'\)/)
    assert.doesNotMatch(viewer, /photo\.viewer\.shareAndDownloadOriginal/)
    assert.match(viewer, /:aria-label="\$t\('ui\.action\.share\.tooltip'\)"/)
  })

  it('guards share preview downloads from failed or non-image responses', () => {
    const shareModal = readSource('app/components/photo/ShareModal.vue')

    assert.match(shareModal, /downloadOgImage/)
    assert.doesNotMatch(shareModal, /__og-image__/)
    assert.match(
      shareModal,
      /\/api\/photos\/\$\{props\.photo\.id\}\/share-preview/,
    )
    assert.match(shareModal, /if \(!response\.ok\)/)
    assert.match(shareModal, /headers\.get\('content-type'\)/)
    assert.match(shareModal, /startsWith\('image\/'\)/)
    assert.match(shareModal, /:disabled="ogImageLoading \|\| ogImageError"/)
  })

  it('adds a stable share preview image endpoint backed by generated variants', () => {
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/share-preview.get.ts',
          import.meta.url,
        ),
      ),
      true,
    )

    const route = readSource('server/api/photos/[photoId]/share-preview.get.ts')
    assert.match(route, /import sharp from 'sharp'/)
    assert.match(route, /isPhotoVisibleToRequest\(event,\s*photoId\)/)
    assert.match(route, /Content-Type['"],\s*['"]image\/png/)
    assert.match(
      route,
      /sharp\(sourceBuffer,\s*\{\s*limitInputPixels:\s*false\s*\}\)/,
    )
    assert.match(route, /png\(/)
    assert.match(
      route,
      /photo\.imageVariants\?\.card\?\.key[\s\S]*photo\.imageVariants\?\.view\?\.key[\s\S]*photo\.imageVariants\?\.thumb\?\.key[\s\S]*photo\.thumbnailKey[\s\S]*photo\.storageKey/,
    )
  })

  it('uses sharp/libvips for efficient webp variant compression', () => {
    const variants = readSource('server/services/image/variants.ts')

    assert.match(variants, /import sharp from 'sharp'/)
    assert.match(variants, /webp\(\{\s*quality:\s*definition\.quality/)
    assert.match(variants, /fastShrinkOnLoad:\s*false/)
    assert.match(variants, /format:\s*'webp'/)
  })

  it('adds dashboard variant status and rebuild actions', () => {
    const dashboardPhotos = readSource('app/pages/dashboard/photos.vue')

    assert.match(
      dashboardPhotos,
      /imageVariants:\s*\$t\('dashboard\.photos\.table\.columns\.imageVariants'\)/,
    )
    assert.match(dashboardPhotos, /id:\s*'imageVariants'/)
    assert.match(dashboardPhotos, /getImageVariantStatus\(row\.original\)/)
    assert.match(dashboardPhotos, /handleRebuildVariantsSingle/)
    assert.match(dashboardPhotos, /handleBatchRebuildVariants/)
    assert.match(dashboardPhotos, /type:\s*'photo-variants'/)
    assert.match(dashboardPhotos, /dashboard\.photos\.actions\.rebuildVariants/)
    assert.match(
      dashboardPhotos,
      /dashboard\.photos\.selection\.batchRebuildVariants/,
    )
  })

  it('keeps full reprocess separate from variant-only rebuild', () => {
    const dashboardPhotos = readSource('app/pages/dashboard/photos.vue')

    assert.match(
      dashboardPhotos,
      /handleReprocessSingle[\s\S]*payload:\s*\{[\s\S]*type:\s*'photo'[\s\S]*storageKey:\s*photo\.storageKey/,
    )
    assert.match(
      dashboardPhotos,
      /handleRebuildVariantsSingle[\s\S]*payload:\s*\{[\s\S]*type:\s*'photo-variants'[\s\S]*photoId:\s*photo\.id/,
    )
  })
})
