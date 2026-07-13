import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readText = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const assertLocalMapEnvDefaults = (envText) => {
  assert.match(envText, /^NUXT_PUBLIC_MAP_PROVIDER=maplibre$/m)
  assert.match(envText, /^NUXT_PUBLIC_MAP_MAPLIBRE_STYLE=\/maps\/style\.json\?v=global$/m)
  assert.match(envText, /^PMTILES_IMAGE=protomaps\/go-pmtiles:latest$/m)
  assert.match(envText, /^PMTILES_TILESET=global$/m)
  assert.match(envText, /^PMTILES_FILENAME=global\.pmtiles$/m)
  assert.match(envText, /^MAPLIBRE_IMAGE=nginx:alpine$/m)
}

describe('local PMTiles map configuration', () => {
  it('uses local MapLibre and PMTiles defaults in the example env file', () => {
    assertLocalMapEnvDefaults(readText('../.env.example'))
  })

  it('uses MapLibre as the server-side default provider', () => {
    const settingsConstants = readText('../server/services/settings/contants.ts')
    assert.match(
      settingsConstants,
      /key: 'provider',[\s\S]*?defaultValue: 'maplibre',/,
    )
    assert.match(
      settingsConstants,
      /key: 'maplibre\.style',[\s\S]*?defaultValue: '\/maps\/style\.json\?v=global',/,
    )

    const wizardDefaults = readText('../server/utils/wizard-env-defaults.ts')
    assert.match(wizardDefaults, /return 'maplibre'/)
    assert.match(wizardDefaults, /'\/maps\/style\.json\?v=global'/)
  })

  it('keeps Mapbox and MapLibre renderer branches available', () => {
    const provider = readText('../app/components/map/Provider.vue')
    assert.match(provider, /provider \|\| 'maplibre'/)
    assert.match(provider, /MglMap/)
    assert.match(provider, /MapboxMap/)
    assert.match(provider, /provider === 'maplibre'/)

    const marker = readText('../app/components/map/ProviderMarker.vue')
    assert.match(marker, /MglMarker/)
    assert.match(marker, /MapboxDefaultMarker/)
    assert.match(marker, /provider === 'mapbox'/)
  })

  it('includes local PMTiles and MapLibre middleware services without host ports', () => {
    const compose = readText('../third-party/middleware/docker-compose.yml')
    assert.match(compose, /^\s{2}pmtiles:/m)
    assert.match(compose, /^\s{2}maplibre:/m)
    assert.match(compose, /container_name: lumamemo_pmtiles/)
    assert.match(compose, /container_name: lumamemo_maplibre/)
    assert.match(compose, /data\/middleware\/pmtiles/)
    assert.match(compose, /data\/middleware\/maplibre\/public/)
    assert.doesNotMatch(compose, /^\s+ports:/m)
  })

  it('exposes local maps and tiles only through the gateway', () => {
    const gateway = readText('../third-party/middleware/gateway/nginx.conf')
    assert.match(gateway, /location = \/maps\/style\.json/)
    assert.match(gateway, /proxy_pass \$lumamemo_upstream\/api\/maps\/style\.json/)
    assert.match(gateway, /location \/maps\//)
    assert.match(gateway, /set \$maplibre_upstream http:\/\/maplibre:80;/)
    assert.match(gateway, /proxy_pass \$maplibre_upstream\//)
    assert.match(gateway, /location \/tiles\//)
    assert.match(gateway, /rewrite \^\/tiles\/\(\.\*\)\$ \/global\/\$1 break;/)
    assert.match(gateway, /set \$pmtiles_upstream http:\/\/pmtiles:8080;/)
    assert.match(gateway, /proxy_pass \$pmtiles_upstream/)
  })

  it('keeps the static local MapLibre style free of remote map dependencies', () => {
    const style = readText('../third-party/middleware/maplibre/public/style.json')
    const parsed = JSON.parse(style)
    assert.equal(parsed.version, 8)
    assert.equal(parsed.metadata['lumamemo:tileset'], 'global')
    assert.equal(parsed.sources.protomaps.type, 'vector')
    assert.deepEqual(parsed.sources.protomaps.tiles, ['/tiles/{z}/{x}/{y}.mvt'])
    assert.equal(parsed.glyphs, '/maps/fonts/{fontstack}/{range}.pbf')
    assert.doesNotMatch(style, /mapbox:\/\//)
    assert.doesNotMatch(style, /api\.mapbox\.com/)
    assert.doesNotMatch(style, /api\.maptiler\.com/)
  })

  it('builds a browser-safe same-origin MapLibre style with absolute tile URLs and local glyph rendering', async () => {
    const { buildLocalMapStyle } = await import('../server/utils/local-map-style.ts')
    const style = buildLocalMapStyle('http://localhost:3000')

    assert.equal(style.metadata['lumamemo:tileset'], 'global')
    assert.deepEqual(style.sources.protomaps.tiles, [
      'http://localhost:3000/tiles/{z}/{x}/{y}.mvt',
    ])
    assert.equal(style.glyphs, 'http://localhost:3000/maps/fonts/{fontstack}/{range}.pbf')
    assert.equal(style.sources.protomaps.maxzoom, 15)
  })

  it('downloads PMTiles without using system proxy variables', () => {
    const script = readText(
      '../third-party/middleware/pmtiles/scripts/download-pmtiles.sh',
    )
    assert.match(script, /PMTILES_URL/)
    assert.match(script, /--noproxy '\*'/)
    assert.match(script, /HTTP_PROXY=/)
    assert.match(script, /HTTPS_PROXY=/)
    assert.match(script, /ALL_PROXY=/)
    assert.match(script, /NO_PROXY='\*'/)
  })

  it('downloads local MapLibre glyph assets without using system proxy variables', () => {
    const script = readText(
      '../third-party/middleware/maplibre/scripts/download-protomaps-assets.sh',
    )
    assert.match(script, /data\/middleware\/maplibre\/public/)
    assert.match(script, /DEFAULT_STYLE_FILE/)
    assert.match(script, /style\.json/)
    assert.match(script, /MAPLIBRE_GLYPHS_BASE_URL/)
    assert.match(script, /Noto Sans Regular/)
    assert.match(script, /--noproxy '\*'/)
    assert.match(script, /HTTP_PROXY=/)
    assert.match(script, /HTTPS_PROXY=/)
    assert.match(script, /ALL_PROXY=/)
    assert.match(script, /NO_PROXY='\*'/)
  })

  it('starts local Nominatim imports through a proxy-free script entrypoint', () => {
    const script = readText(
      '../third-party/middleware/nominatim/scripts/import-region.sh',
    )
    assert.match(script, /china-latest\.osm\.pbf/)
    assert.match(script, /monaco-latest\.osm\.pbf/)
    assert.match(script, /NOMINATIM_PBF_URL/)
    assert.match(script, /docker compose/)
    assert.match(script, /up -d nominatim/)
    assert.match(script, /HTTP_PROXY=/)
    assert.match(script, /HTTPS_PROXY=/)
    assert.match(script, /ALL_PROXY=/)
    assert.match(script, /NO_PROXY='\*'/)
  })

  it('documents downloaded MapLibre assets under the local data mount', () => {
    const readme = readText('../third-party/middleware/README.md')
    assert.match(readme, /data\/middleware\/maplibre\/public/)
    assert.match(readme, /style\.json/)
    assert.match(readme, /fonts/)
    assert.match(readme, /sprites/)
  })
})
