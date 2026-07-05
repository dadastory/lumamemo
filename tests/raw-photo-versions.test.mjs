import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  getPhotoDisplayStorageKey,
  isDisplayImageStorageKey,
  isRawStorageKey,
  serializePhotoAsset,
} from '../server/utils/raw-photo.ts'
import {
  getUserOwnedPhotoStorageKeys,
  getPhotoStorageKeys,
} from '../server/utils/photo-delete.ts'
import {
  serializeAdminPhoto,
  serializePublicPhoto,
} from '../server/utils/security.ts'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('RAW photo versions', () => {
  const rawPhoto = {
    id: 'raw-1',
    title: 'RAW frame',
    description: '',
    width: 6000,
    height: 4000,
    aspectRatio: 1.5,
    dateTaken: '2024-01-02T03:04:05.000Z',
    storageKey: 'photos/users/7/imports/DSC0001.CR3',
    displayStorageKey: 'photos/users/7/raw-previews/raw-1/preview.jpg',
    displayMimeType: 'image/jpeg',
    displayFileSize: 765432,
    displayWidth: 3000,
    displayHeight: 2000,
    sourceType: 'raw',
    thumbnailKey: 'photos/users/7/variants/raw-1/card.webp',
    fileSize: 45000000,
    lastModified: '2024-01-03T00:00:00.000Z',
    originalUrl: '/storage/photos/users/7/imports/DSC0001.CR3',
    thumbnailUrl: '/storage/photos/users/7/variants/raw-1/card.webp',
    thumbnailHash: 'thumbhash',
    imageVariants: {
      card: {
        key: 'photos/users/7/variants/raw-1/card.webp',
        url: '/storage/photos/users/7/variants/raw-1/card.webp',
        width: 960,
        height: 640,
        size: 65000,
        format: 'webp',
      },
    },
    tags: [],
    exif: {
      Make: 'Canon',
      Model: 'EOS R5',
      ISO: 100,
      ExposureTime: '1/250',
      FNumber: 2.8,
    },
    ownerUserId: 7,
    ownerId: 7,
    ownerUsername: 'alice',
    ownerAvatar: null,
    visibility: 'public',
  }

  it('detects RAW originals and display-image assets by extension', () => {
    assert.equal(isRawStorageKey('/photos/users/7/a.CR3?download=1'), true)
    assert.equal(isRawStorageKey('photos/users/7/a.nef'), true)
    assert.equal(isRawStorageKey('photos/users/7/a.jpg'), false)

    assert.equal(isDisplayImageStorageKey('photos/users/7/render.jpg'), true)
    assert.equal(isDisplayImageStorageKey('photos/users/7/render.webp'), true)
    assert.equal(isDisplayImageStorageKey('photos/users/7/original.cr3'), false)
  })

  it('serializes RAW photos with the current display image as the public image URL', () => {
    const publicPhoto = serializePublicPhoto(rawPhoto)
    const adminPhoto = serializeAdminPhoto(rawPhoto)

    assert.equal(publicPhoto.sourceType, 'raw')
    assert.equal(
      publicPhoto.originalUrl,
      '/image/photos/users/7/raw-previews/raw-1/preview.jpg',
    )
    assert.equal('storageKey' in publicPhoto, false)
    assert.equal('displayStorageKey' in publicPhoto, false)

    assert.equal(adminPhoto.sourceType, 'raw')
    assert.equal(adminPhoto.storageKey, 'photos/users/7/imports/DSC0001.CR3')
    assert.equal(
      adminPhoto.displayStorageKey,
      'photos/users/7/raw-previews/raw-1/preview.jpg',
    )
    assert.equal(
      adminPhoto.originalUrl,
      '/image/photos/users/7/raw-previews/raw-1/preview.jpg',
    )
  })

  it('uses the current display source for variants and keeps RAW as the downloadable original', () => {
    assert.equal(
      getPhotoDisplayStorageKey(rawPhoto),
      'photos/users/7/raw-previews/raw-1/preview.jpg',
    )
    assert.equal(
      getPhotoStorageKeys(rawPhoto).includes(
        'photos/users/7/imports/DSC0001.CR3',
      ),
      true,
    )
    assert.equal(
      getPhotoStorageKeys(rawPhoto).includes(
        'photos/users/7/raw-previews/raw-1/preview.jpg',
      ),
      true,
    )
    assert.deepEqual(
      getPhotoStorageKeys({
        ...rawPhoto,
        photoAssets: [
          {
            storageKey: 'photos/users/7/raw-renders/raw-1/edit-a.jpg',
          },
          {
            storageKey: 'photos/users/7/raw-renders/raw-1/edit-b.webp',
          },
        ],
        livePhotoVideoKey: 'photos/users/7/live/raw-1.mov',
      }).sort(),
      [
        'photos/users/7/imports/DSC0001.CR3',
        'photos/users/7/live/raw-1.mov',
        'photos/users/7/raw-previews/raw-1/preview.jpg',
        'photos/users/7/raw-renders/raw-1/edit-a.jpg',
        'photos/users/7/raw-renders/raw-1/edit-b.webp',
        'photos/users/7/variants/raw-1/card.webp',
      ].sort(),
    )
    assert.deepEqual(getUserOwnedPhotoStorageKeys(rawPhoto, 99), [])
  })

  it('normalizes photo asset records without leaking storage keys publicly', () => {
    const asset = {
      id: 12,
      photoId: 'raw-1',
      kind: 'uploaded-render',
      storageKey: 'photos/users/7/raw-renders/raw-1/edit.jpg',
      fileName: 'edit.jpg',
      mimeType: 'image/jpeg',
      fileSize: 900000,
      width: 3000,
      height: 2000,
      isPrimary: true,
      createdAt: new Date('2024-01-04T00:00:00.000Z'),
    }

    assert.deepEqual(serializePhotoAsset(asset, { includeStorageKey: false }), {
      id: 12,
      photoId: 'raw-1',
      kind: 'uploaded-render',
      fileName: 'edit.jpg',
      mimeType: 'image/jpeg',
      fileSize: 900000,
      width: 3000,
      height: 2000,
      isPrimary: true,
      url: '/image/photos/users/7/raw-renders/raw-1/edit.jpg',
      createdAt: new Date('2024-01-04T00:00:00.000Z'),
    })
    assert.equal(
      serializePhotoAsset(asset, { includeStorageKey: true }).storageKey,
      'photos/users/7/raw-renders/raw-1/edit.jpg',
    )
  })

  it('adds RAW version management endpoints and keeps homepage surfaces grouped', () => {
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/assets/index.get.ts',
          import.meta.url,
        ),
      ),
      true,
    )
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/assets/index.post.ts',
          import.meta.url,
        ),
      ),
      true,
    )
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/assets/[assetId]/primary.post.ts',
          import.meta.url,
        ),
      ),
      true,
    )
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/display.get.ts',
          import.meta.url,
        ),
      ),
      true,
    )
    assert.equal(
      existsSync(
        new URL(
          '../server/api/photos/[photoId]/display/rotate.post.ts',
          import.meta.url,
        ),
      ),
      true,
    )

    const profilePhotos = readSource(
      'server/api/public/profiles/[publicId]/photos.get.ts',
    )
    assert.match(profilePhotos, /from\(tables\.photos\)/)
    assert.doesNotMatch(profilePhotos, /photoAssets/)

    const viewer = readSource('app/components/photo/Viewer.vue')
    assert.match(viewer, /downloadOriginalImage/)
    assert.match(viewer, /downloadDisplayImage/)
    assert.match(viewer, /photo\.viewer\.downloadRawOriginal/)
    assert.match(viewer, /photo\.viewer\.downloadCurrentDisplay/)
    assert.match(viewer, /PhotoAssetPanel/)
  })

  it('localizes RAW version management and RAW download actions', () => {
    const panel = readSource('app/components/photo/PhotoAssetPanel.vue')
    const viewer = readSource('app/components/photo/Viewer.vue')
    const localeFiles = [
      'i18n/locales/en.json',
      'i18n/locales/zh-Hans.json',
      'i18n/locales/zh-Hant-TW.json',
      'i18n/locales/zh-Hant-HK.json',
      'i18n/locales/ja.json',
    ]

    for (const hardcoded of [
      'RAW versions',
      'Uploading...',
      'Add render',
      'Download current display image',
    ]) {
      assert.doesNotMatch(
        panel,
        new RegExp(hardcoded.replace('...', '\\.\\.\\.')),
      )
      assert.doesNotMatch(
        viewer,
        new RegExp(hardcoded.replace('...', '\\.\\.\\.')),
      )
    }
    assert.doesNotMatch(panel, />\s*Primary\s*</)
    assert.doesNotMatch(panel, />\s*Set\s*</)
    assert.doesNotMatch(panel, />\s*\{\{ assets\.length \}\} versions\s*</)

    assert.match(panel, /photo\.rawVersions\.title/)
    assert.match(panel, /photo\.rawVersions\.addRender/)
    assert.match(panel, /photo\.rawVersions\.rotateLeft/)
    assert.match(panel, /photo\.rawVersions\.rotateRight/)
    assert.match(viewer, /photo\.viewer\.downloadRawOriginal/)
    assert.match(viewer, /photo\.viewer\.downloadCurrentDisplay/)

    for (const file of localeFiles) {
      const locale = JSON.parse(readSource(file))
      assert.equal(typeof locale.photo.viewer.downloadRawOriginal, 'string')
      assert.equal(typeof locale.photo.viewer.downloadCurrentDisplay, 'string')
      assert.equal(typeof locale.photo.viewer.rawOriginalDownloaded, 'string')
      assert.equal(typeof locale.photo.viewer.displayImageDownloaded, 'string')
      assert.equal(typeof locale.photo.rawVersions.title, 'string')
      assert.equal(typeof locale.photo.rawVersions.addRender, 'string')
      assert.equal(typeof locale.photo.rawVersions.rotateLeft, 'string')
      assert.equal(typeof locale.photo.rawVersions.rotateRight, 'string')
    }
  })

  it('authorizes display and version asset image keys through the image gateway', () => {
    const security = readSource('server/utils/security.ts')

    assert.match(security, /photo\.displayStorageKey === normalizedKey/)
    assert.match(security, /from\(tables\.photoAssets\)/)
    assert.match(
      security,
      /eq\(tables\.photoAssets\.storageKey, normalizedKey\)/,
    )
    assert.match(security, /const isRawOriginalKey/)
    assert.match(security, /photo\.sourceType === 'raw'/)
  })

  it('uses RAW display images before RAW originals for generated share previews', () => {
    const sharePreview = readSource(
      'server/api/photos/[photoId]/share-preview.get.ts',
    )

    assert.ok(
      sharePreview.indexOf('photo.displayStorageKey') <
        sharePreview.indexOf('photo.storageKey'),
    )
  })

  it('wires RAW extraction into the existing image pipeline', () => {
    const rawService = readSource('server/services/image/raw.ts')
    const rawUtils = readSource('server/utils/raw-photo.ts')
    const processor = readSource('server/services/image/processor.ts')
    const manager = readSource('server/services/pipeline-queue/manager.ts')

    assert.match(rawService, /RAW_PREVIEW_CANDIDATE_TAGS/)
    assert.match(rawService, /PreviewImage/)
    assert.match(rawService, /JpgFromRaw/)
    assert.match(rawService, /OtherImage/)
    assert.match(rawService, /ThumbnailImage/)
    assert.match(rawService, /extractBinaryTag/)
    assert.match(rawService, /sharp\(selected\.buffer/)
    assert.match(rawService, /\.rotate\(\)/)
    assert.match(rawService, /orientedBuffer/)
    assert.match(rawService, /sort\(\(a, b\) => b\.area - a\.area\)/)
    assert.doesNotMatch(rawService, /extractJpgFromRaw/)
    assert.match(rawUtils, /raw-previews/)
    assert.match(processor, /isRawStorageKey/)
    assert.match(manager, /getPhotoDisplayStorageKey/)
    assert.match(manager, /displayStorageKey/)
  })

  it('rotates RAW display images without modifying the RAW original', () => {
    const rotateApi = readSource(
      'server/api/photos/[photoId]/display/rotate.post.ts',
    )

    assert.match(
      rotateApi,
      /z\.union\(\[z\.literal\(-90\), z\.literal\(90\)\]\)/,
    )
    assert.match(rotateApi, /photo\.sourceType !== 'raw'/)
    assert.match(rotateApi, /displayStorageKey/)
    assert.match(rotateApi, /sharp\(buffer/)
    assert.match(rotateApi, /\.rotate\(payload\.degrees\)/)
    assert.match(rotateApi, /storageProvider\.create\([^)]*displayStorageKey/)
    assert.match(rotateApi, /photo-variants/)
    assert.doesNotMatch(
      rotateApi,
      /storageProvider\.create\([^)]*photo\.storageKey/,
    )
  })

  it('refreshes RAW display images in the viewer after display changes', () => {
    const viewer = readSource('app/components/photo/Viewer.vue')

    assert.match(viewer, /rawDisplayRefreshTokens/)
    assert.match(viewer, /appendRefreshToken/)
    assert.match(viewer, /refreshRawDisplay\(photo\.id\)/)
    assert.match(viewer, /getRefreshablePhotoDisplayUrl\(photo\)/)
    assert.match(viewer, /getRefreshablePhotoVariantUrl\(photo, 'card'\)/)
    assert.match(viewer, /:key="`?\$\{photo\.id\}/)
  })

  it('waits for RAW variant rebuild completion before updating the viewer', () => {
    const panel = readSource('app/components/photo/PhotoAssetPanel.vue')

    assert.match(panel, /startVariantTaskStatusCheck/)
    assert.match(panel, /\/api\/queue\/stats\/\$\{taskId\}/)
    assert.match(panel, /response\.status === 'completed'/)
    assert.match(panel, /\/api\/photos\/\$\{props\.photo\.id\}\/detail/)
    assert.match(panel, /emit\('photo-updated', refreshedPhoto\)/)
    assert.match(panel, /response\.status === 'failed'/)
    assert.match(panel, /processingTaskId/)
    assert.match(panel, /photo\.rawVersions\.processing/)
  })

  it('bubbles completed RAW photo updates to the app-level photo sources', () => {
    const viewer = readSource('app/components/photo/Viewer.vue')
    const app = readSource('app/app.vue')

    assert.match(viewer, /'photo-updated':\s*\[photo: Photo\]/)
    assert.doesNotMatch(viewer, /Object\.assign\(props\.photos/)
    assert.match(viewer, /emit\('photo-updated', photo\)/)

    assert.match(app, /const handlePhotoUpdated = \(photo: Photo\)/)
    assert.match(app, /data\.value = replacePhotoInList\(/)
    assert.match(app, /scopedPhotos\.value\s*=\s*replacePhotoInList\(/)
    assert.match(app, /@photo-updated="handlePhotoUpdated"/)
  })

  it('adds cache tokens to refreshed RAW thumbnail and variant URLs', () => {
    const app = readSource('app/app.vue')

    assert.match(app, /const appendPhotoUrlToken = \(/)
    assert.match(app, /const withPhotoUrlCacheToken = \(photo: Photo\)/)
    assert.match(app, /thumbnailUrl: appendPhotoUrlToken\(/)
    assert.match(app, /originalUrl: appendPhotoUrlToken\(/)
    assert.match(app, /imageVariants: tokenedImageVariants/)
    assert.match(app, /lastModified/)
  })

  it('keeps the current RAW display asset metadata in sync after rotation', () => {
    const rotateApi = readSource(
      'server/api/photos/[photoId]/display/rotate.post.ts',
    )

    assert.match(rotateApi, /update\(tables\.photoAssets\)/)
    assert.match(rotateApi, /eq\(tables\.photoAssets\.photoId, photoId\)/)
    assert.match(
      rotateApi,
      /eq\(tables\.photoAssets\.storageKey, displayStorageKey\)/,
    )
    assert.match(rotateApi, /fileSize: rotatedBuffer\.length/)
    assert.match(rotateApi, /width: metadata\.width/)
    assert.match(rotateApi, /height: metadata\.height/)
  })

  it('clears stale RAW variants when display images change', () => {
    const rotateApi = readSource(
      'server/api/photos/[photoId]/display/rotate.post.ts',
    )
    const primaryApi = readSource(
      'server/api/photos/[photoId]/assets/[assetId]/primary.post.ts',
    )

    for (const source of [rotateApi, primaryApi]) {
      assert.match(source, /thumbnailKey: null/)
      assert.match(source, /thumbnailUrl: null/)
      assert.match(source, /thumbnailHash: null/)
      assert.match(source, /imageVariants: null/)
      assert.match(source, /lastModified: new Date\(\)\.toISOString\(\)/)
      assert.match(source, /ownerUserId: photo\.ownerUserId/)
    }
  })

  it('provides an owner-scoped photo detail endpoint for completed RAW updates', () => {
    const detailApi = readSource('server/api/photos/[photoId]/detail.get.ts')

    assert.match(detailApi, /requireActiveUserSession/)
    assert.match(detailApi, /canManageOwnedResource/)
    assert.match(detailApi, /serializeAdminPhoto/)
  })

  it('deletes non-primary RAW version assets without deleting the current display image', () => {
    const deleteApi = readSource(
      'server/api/photos/[photoId]/assets/[assetId]/index.delete.ts',
    )

    assert.match(deleteApi, /requireActiveUserSession/)
    assert.match(deleteApi, /canManageOwnedResource/)
    assert.match(deleteApi, /asset\.isPrimary/)
    assert.match(deleteApi, /asset\.storageKey === photo\.displayStorageKey/)
    assert.match(deleteApi, /delete\(tables\.photoAssets\)/)
    assert.match(deleteApi, /storageProvider\.delete\(asset\.storageKey\)/)
  })

  it('localizes RAW processing and version deletion actions', () => {
    const localeFiles = [
      'i18n/locales/en.json',
      'i18n/locales/zh-Hans.json',
      'i18n/locales/zh-Hant-TW.json',
      'i18n/locales/zh-Hant-HK.json',
      'i18n/locales/ja.json',
    ]

    for (const file of localeFiles) {
      const locale = JSON.parse(readSource(file))
      assert.equal(typeof locale.photo.rawVersions.processing, 'string')
      assert.equal(typeof locale.photo.rawVersions.processingFailed, 'string')
      assert.equal(typeof locale.photo.rawVersions.reloadFailed, 'string')
      assert.equal(typeof locale.photo.rawVersions.deleteVersion, 'string')
      assert.equal(typeof locale.photo.rawVersions.deleteConfirm, 'string')
      assert.equal(typeof locale.photo.rawVersions.deleteFailed, 'string')
      assert.equal(
        typeof locale.photo.rawVersions.cannotDeletePrimary,
        'string',
      )
    }
  })
})
