import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { applyWizardSchemaDefaults } from '../shared/utils/wizard-defaults.ts'
import {
  getWizardMapDefaults,
  getWizardStorageDefaults,
} from '../server/utils/wizard-env-defaults.ts'

describe('wizard environment defaults', () => {
  it('prefills storage fields from runtime environment variables', () => {
    const env = {
      NUXT_STORAGE_PROVIDER: 's3',
      NUXT_PROVIDER_S3_ENDPOINT: 'http://minio:9000',
      NUXT_PROVIDER_S3_BUCKET: 'lumamemo',
      NUXT_PROVIDER_S3_REGION: 'us-east-1',
      NUXT_PROVIDER_S3_ACCESS_KEY_ID: 'lumamemo',
      NUXT_PROVIDER_S3_SECRET_ACCESS_KEY: 'secret',
      NUXT_PROVIDER_S3_PREFIX: 'photos/',
      NUXT_PROVIDER_S3_CDN_URL: 'http://localhost:9000/lumamemo',
      NUXT_PROVIDER_S3_FORCE_PATH_STYLE: 'true',
      NUXT_PROVIDER_LOCAL_PATH: '/app/data/storage',
      NUXT_PROVIDER_LOCAL_BASE_URL: '/storage',
    }

    const defaults = getWizardStorageDefaults(env)

    assert.equal(defaults.provider, 's3')
    assert.equal(defaults['s3.endpoint'], 'http://minio:9000')
    assert.equal(defaults['s3.bucket'], 'lumamemo')
    assert.equal(defaults['s3.region'], 'us-east-1')
    assert.equal(defaults['s3.accessKeyId'], 'lumamemo')
    assert.equal(defaults['s3.secretAccessKey'], 'secret')
    assert.equal(defaults['s3.prefix'], 'photos/')
    assert.equal(defaults['s3.cdnUrl'], 'http://localhost:9000/lumamemo')
    assert.equal(defaults['s3.forcePathStyle'], true)
    assert.equal(defaults['local.basePath'], '/app/data/storage')
    assert.equal(defaults['local.baseUrl'], '/storage')
  })

  it('prefills map fields from runtime environment variables', () => {
    const defaults = getWizardMapDefaults({
      NUXT_PUBLIC_MAP_PROVIDER: 'maplibre',
      NUXT_PUBLIC_MAP_MAPLIBRE_STYLE: 'http://localhost:8080/style.json',
      NUXT_PUBLIC_MAP_MAPLIBRE_TOKEN: '',
      NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
      NUXT_PUBLIC_MAP_MAPBOX_STYLE: 'mapbox://styles/mapbox/light-v11',
    })

    assert.equal(defaults.provider, 'maplibre')
    assert.equal(defaults['maplibre.style'], 'http://localhost:8080/style.json')
    assert.equal(defaults['maplibre.token'], '')
    assert.equal(defaults['mapbox.token'], 'pk.test')
    assert.equal(defaults['mapbox.style'], 'mapbox://styles/mapbox/light-v11')
  })

  it('defaults maps to local MapLibre when no map env is configured', () => {
    const defaults = getWizardMapDefaults({})

    assert.equal(defaults.provider, 'maplibre')
    assert.equal(defaults['maplibre.style'], '/maps/style.json?v=global')
    assert.equal(defaults['maplibre.token'], '')
  })

  it('only fills cached wizard state fields that are missing or empty', () => {
    const merged = applyWizardSchemaDefaults(
      {
        provider: 's3',
        's3.endpoint': 'http://minio:9000',
        's3.bucket': 'lumamemo',
        's3.forcePathStyle': true,
      },
      {
        provider: 'local',
        's3.endpoint': '',
        's3.bucket': null,
        's3.forcePathStyle': false,
      },
    )

    assert.deepEqual(merged, {
      provider: 'local',
      's3.endpoint': 'http://minio:9000',
      's3.bucket': 'lumamemo',
      's3.forcePathStyle': false,
    })
  })
})
