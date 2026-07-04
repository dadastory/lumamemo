import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('local Nominatim configuration', () => {
  it('uses the China extract as the local debug import source', () => {
    const env = readSource('.env.example')

    assert.match(
      env,
      /^NOMINATIM_PBF_URL=https:\/\/download\.geofabrik\.de\/asia\/china-latest\.osm\.pbf$/m,
    )
  })

  it('documents the script-based local Nominatim import flow', () => {
    const readme = readSource('third-party/middleware/nominatim/README.md')
    const middlewareReadme = readSource('third-party/middleware/README.md')

    assert.match(readme, /scripts\/import-region\.sh china/)
    assert.match(middlewareReadme, /scripts\/import-region\.sh china/)
    assert.match(middlewareReadme, /NOMINATIM_RESET_DATA=1/)
  })

  it('uses runtime Nominatim config when the settings table value is empty', () => {
    const source = readSource('server/services/location/geocoding.ts')
    const settingsIndex = source.indexOf("'nominatim.baseUrl'")
    const runtimeIndex = source.indexOf('runtimeConfig.nominatim?.baseUrl')
    const providerIndex = source.indexOf('new NominatimGeocodingProvider')

    assert.notEqual(settingsIndex, -1)
    assert.notEqual(runtimeIndex, -1)
    assert.notEqual(providerIndex, -1)
    assert.ok(
      settingsIndex < runtimeIndex && runtimeIndex < providerIndex,
      'Nominatim provider should prefer settings, then runtime config, before falling back',
    )
  })

  it('migrates the runtime Nominatim base URL into settings without overriding existing values', () => {
    const source = readSource('server/plugins/2.settings-manager.ts')

    assert.match(source, /config\.nominatim\?\.baseUrl/)
    assert.match(source, /location'[\s\S]*?'nominatim\.baseUrl'/)
    assert.match(source, /preserveExisting/)
  })
})
