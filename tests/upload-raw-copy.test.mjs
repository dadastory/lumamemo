import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const readJson = (path) => JSON.parse(readSource(path))

const localeFiles = [
  'i18n/locales/en.json',
  'i18n/locales/zh-Hans.json',
  'i18n/locales/zh-Hant-TW.json',
  'i18n/locales/zh-Hant-HK.json',
  'i18n/locales/ja.json',
]

const rawExtensions = [
  '.3fr',
  '.arw',
  '.cr2',
  '.cr3',
  '.crw',
  '.dcr',
  '.dng',
  '.erf',
  '.fff',
  '.iiq',
  '.kdc',
  '.mef',
  '.mos',
  '.mrw',
  '.nef',
  '.nrw',
  '.orf',
  '.pef',
  '.raf',
  '.rwl',
  '.rw2',
  '.srw',
  '.x3f',
]

const rawMimeTypes = [
  'image/3fr',
  'image/arw',
  'image/cr2',
  'image/cr3',
  'image/crw',
  'image/dcr',
  'image/dng',
  'image/erf',
  'image/fff',
  'image/iiq',
  'image/kdc',
  'image/mef',
  'image/mos',
  'image/mrw',
  'image/nef',
  'image/nrw',
  'image/orf',
  'image/pef',
  'image/raf',
  'image/rwl',
  'image/rw2',
  'image/srw',
  'image/x3f',
  'image/x-adobe-dng',
  'image/x-canon-crw',
  'image/x-canon-cr2',
  'image/x-canon-cr3',
  'image/x-epson-erf',
  'image/x-fuji-raf',
  'image/x-hasselblad-3fr',
  'image/x-kodak-dcr',
  'image/x-kodak-kdc',
  'image/x-leaf-iiq',
  'image/x-mamiya-mef',
  'image/x-minolta-mrw',
  'image/x-nikon-nef',
  'image/x-nikon-nrw',
  'image/x-olympus-orf',
  'image/x-panasonic-rw2',
  'image/x-pentax-pef',
  'image/x-samsung-srw',
  'image/x-sigma-x3f',
  'image/x-sony-arw',
  'image/x-sony-sr2',
  'image/x-sony-srf',
]

describe('RAW upload guidance', () => {
  it('mentions RAW in every upload format summary and dropzone description', () => {
    for (const file of localeFiles) {
      const locale = readJson(file)
      const photos = locale.dashboard.photos

      assert.match(
        photos.supportedFormats,
        /RAW/i,
        `${file} supportedFormats should mention RAW`,
      )
      assert.match(
        photos.uploader.description,
        /RAW/i,
        `${file} uploader.description should mention RAW`,
      )
      assert.match(
        photos.uploader.description,
        /\{maxSize\}/,
        `${file} uploader.description should keep the dynamic maxSize placeholder`,
      )
    }
  })

  it('keeps RAW files selectable and accepted by frontend validation', () => {
    const source = readSource('app/pages/dashboard/photos.vue')
    const sharedRawUtils = readSource('shared/utils/raw-photo.ts')

    for (const extension of rawExtensions) {
      assert.match(
        sharedRawUtils,
        new RegExp(extension.replace('.', '\\.')),
        `${extension} should be in the shared RAW extension list`,
      )
    }

    for (const mimeType of rawMimeTypes) {
      assert.match(sharedRawUtils, new RegExp(mimeType.replace('/', '\\/')))
    }

    assert.match(source, /isSupportedRawFile\(file\)/)
    assert.doesNotMatch(source, /const rawExtensions = \[/)
  })

  it('allows RAW MIME types in the default upload whitelist and example env', () => {
    const config = readSource('nuxt.config.ts')
    const envExample = readSource('.env.example')

    assert.match(config, /RAW_MIME_TYPES/)

    for (const mimeType of rawMimeTypes) {
      assert.match(
        envExample,
        new RegExp(mimeType.replace('/', '\\/')),
        `${mimeType} should be documented in .env.example`,
      )
    }
  })

  it('allows RAW extensions when browsers upload them as octet-stream', () => {
    const uploadApi = readSource('server/api/photos/upload.put.ts')

    assert.match(uploadApi, /isSupportedRawUpload\(storageKey,\s*contentType\)/)
    assert.match(uploadApi, /application\/octet-stream/)
    assert.match(uploadApi, /isAllowedRawUpload/)
    assert.match(
      uploadApi,
      /!allowedTypes\.includes\(contentType\)[\s\S]*!isAllowedRawUpload/,
    )
  })

  it('keeps RAW upload support centralized across upload entry points', () => {
    const uploadPage = readSource('app/pages/dashboard/photos.vue')
    const signApi = readSource('server/api/photos/index.post.ts')
    const originalApi = readSource(
      'server/api/photos/[photoId]/original.get.ts',
    )
    const serverRawUtils = readSource('server/utils/raw-photo.ts')

    assert.match(uploadPage, /RAW_UPLOAD_ACCEPT/)
    assert.match(uploadPage, /getUploadContentType\(file\)/)
    assert.match(signApi, /RAW_PHOTO_EXTENSIONS/)
    assert.match(originalApi, /RAW_EXTENSION_MIME_TYPES/)
    assert.match(serverRawUtils, /shared\/utils\/raw-photo/)
  })

  it('does not treat non-2xx XHR load events as successful uploads', () => {
    const uploadComposable = readSource('app/composables/useUpload.ts')
    const loadHandler = uploadComposable.match(
      /xhr\.addEventListener\('load', \(\) => \{([\s\S]*?)\n      \}\)/,
    )?.[1]

    assert.ok(loadHandler, 'load event handler should exist')
    assert.match(loadHandler, /xhr\.status >= 200 && xhr\.status < 300/)
    assert.match(
      loadHandler,
      /if\s*\(\s*xhr\.status >= 200 && xhr\.status < 300\s*\)\s*\{[\s\S]*callbacks\.onSuccess\?\.\(xhr\)[\s\S]*resolve\(xhr\)/,
    )
    assert.match(loadHandler, /handleUploadHttpError\(/)
  })
})
