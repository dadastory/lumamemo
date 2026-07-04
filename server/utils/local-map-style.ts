const baseLocalMapStyle = {
  version: 8,
  name: 'ChronoFrame Local PMTiles',
  metadata: {
    'chronoframe:tileset': 'global',
    'chronoframe:source': 'local-pmtiles',
    'chronoframe:bounds': [-180, -85.051129, 180, 85.051129],
  },
  sources: {
    protomaps: {
      type: 'vector',
      tiles: ['/tiles/{z}/{x}/{y}.mvt'],
      minzoom: 0,
      maxzoom: 15,
      bounds: [-180, -85.051129, 180, 85.051129],
    },
  },
  glyphs: '/maps/fonts/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#dbe7f0',
      },
    },
    {
      id: 'earth',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'earth',
      paint: {
        'fill-color': '#e5eadc',
      },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'landcover',
      paint: {
        'fill-color': [
          'match',
          ['get', 'kind'],
          ['forest', 'wood'],
          '#c9dfbc',
          ['grass', 'scrub', 'wetland'],
          '#d5e8c8',
          '#e5eadc',
        ],
        'fill-opacity': 0.72,
      },
    },
    {
      id: 'landuse',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'landuse',
      minzoom: 5,
      paint: {
        'fill-color': [
          'match',
          ['get', 'kind'],
          ['park', 'nature_reserve', 'forest', 'wood'],
          '#c8e2b8',
          ['cemetery', 'golf_course', 'grass'],
          '#d5e8c8',
          ['industrial'],
          '#dedbd2',
          '#e9eadf',
        ],
        'fill-opacity': 0.82,
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'water',
      paint: {
        'fill-color': '#8fbfe0',
      },
    },
    {
      id: 'boundaries',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'boundaries',
      minzoom: 3,
      paint: {
        'line-color': '#81909b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 8, 1.1],
        'line-opacity': 0.58,
      },
    },
    {
      id: 'roads-minor',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      minzoom: 10,
      filter: [
        'match',
        ['get', 'kind'],
        ['path', 'minor_road', 'service', 'other'],
        true,
        false,
      ],
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 3],
      },
    },
    {
      id: 'roads-major',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      minzoom: 5,
      filter: [
        'match',
        ['get', 'kind'],
        ['highway', 'major_road', 'medium_road'],
        true,
        false,
      ],
      paint: {
        'line-color': '#fff5d6',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 2.2, 15, 6.2],
      },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'buildings',
      minzoom: 13,
      paint: {
        'fill-color': '#cec8bd',
        'fill-opacity': 0.9,
      },
    },
    {
      id: 'water-labels',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'water',
      minzoom: 3,
      layout: {
        'text-field': [
          'coalesce',
          ['get', 'name:zh-Hans'],
          ['get', 'name:zh-Hant'],
          ['get', 'name:en'],
          ['get', 'name'],
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#3d7192',
        'text-halo-color': '#eef1f2',
        'text-halo-width': 1,
      },
    },
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'places',
      minzoom: 2,
      layout: {
        'text-field': [
          'coalesce',
          ['get', 'name:zh-Hans'],
          ['get', 'name:zh-Hant'],
          ['get', 'name:en'],
          ['get', 'name'],
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 8, 16],
        'text-padding': 4,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#26323b',
        'text-halo-color': '#f7f8f6',
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'road-labels',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'roads',
      minzoom: 12,
      layout: {
        'symbol-placement': 'line',
        'text-field': [
          'coalesce',
          ['get', 'name:zh-Hans'],
          ['get', 'name:zh-Hant'],
          ['get', 'name:en'],
          ['get', 'name'],
        ],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
      },
      paint: {
        'text-color': '#5f625c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    },
  ],
} as const

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '')

const absoluteSameOriginUrl = (origin: string, path: string) =>
  `${normalizeOrigin(origin)}${path}`

export const buildLocalMapStyle = (origin: string) => {
  const style = JSON.parse(JSON.stringify(baseLocalMapStyle))
  style.sources.protomaps.tiles = [
    absoluteSameOriginUrl(origin, '/tiles/{z}/{x}/{y}.mvt'),
  ]
  style.glyphs = absoluteSameOriginUrl(
    origin,
    '/maps/fonts/{fontstack}/{range}.pbf',
  )
  return style
}

export const getRequestOrigin = (event: { node: { req: { headers: Record<string, string | string[] | undefined> } } }) => {
  const headers = event.node.req.headers
  const forwardedHost = Array.isArray(headers['x-forwarded-host'])
    ? headers['x-forwarded-host'][0]
    : headers['x-forwarded-host']
  const host = forwardedHost || headers.host || 'localhost:3000'
  const forwardedProto = Array.isArray(headers['x-forwarded-proto'])
    ? headers['x-forwarded-proto'][0]
    : headers['x-forwarded-proto']
  const proto = forwardedProto || 'http'
  return `${proto}://${host}`
}
