# LumaMemo local middleware

This directory contains Docker Compose services and support files for local
middleware used by LumaMemo. Runtime data is stored under the project-level
`data/middleware` directory so each service can be reset independently.

These services are optional. The default root Compose stack does not start them.

## Services

- `nominatim`: reverse geocoding service, defaulting to
  `mediagis/nominatim:5.3.2`. The local `.env` defaults to the China PBF
  extract for local reverse-geocoding tests.
- `pmtiles`: local vector tile service. It reads
  `data/middleware/pmtiles/global.pmtiles` by default and serves it internally
  as `global/{z}/{x}/{y}.mvt`.
- `maplibre`: static local MapLibre assets. Its container reads downloaded
  files from `data/middleware/maplibre/public`; the gateway exposes those
  assets under `/maps/` and rewrites browser tile requests from
  `/tiles/{z}/{x}/{y}.mvt` to the PMTiles service.
- `qdrant`: vector database for storing image embeddings used in semantic
  search. Stores data in `data/middleware/qdrant`.

## Common commands

```sh
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml config --quiet
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml up -d
third-party/middleware/nominatim/scripts/import-region.sh china
```

## PMTiles data

Provide a PMTiles URL explicitly and download it without using system proxy
variables:

```sh
PMTILES_URL=https://example.com/global.pmtiles \
PMTILES_FILENAME=global.pmtiles \
third-party/middleware/pmtiles/scripts/download-pmtiles.sh
```

The script writes to `data/middleware/pmtiles/global.pmtiles`. If you use a
different filename, update `PMTILES_TILESET` and the gateway rewrite target
together.

## MapLibre static assets

The local style template stays in `third-party/middleware/maplibre/public`, but
downloaded `style.json`, `fonts`, and `sprites` are written to
`data/middleware/maplibre/public` so local map assets can be managed with the
other middleware data. Download the glyph PBF files without using system proxy
variables:

```sh
third-party/middleware/maplibre/scripts/download-protomaps-assets.sh
```

The default ranges cover Latin labels and common CJK codepoints used by Chinese
place names. Set `MAPLIBRE_GLYPH_RANGES` or `MAPLIBRE_FONTSTACK` if your tile
style uses a different font or codepoint range. Delete
`data/middleware/maplibre/public` to reset the downloaded MapLibre assets.

## Nominatim data

Import a region through the script entrypoint so proxy variables are cleared
consistently:

```sh
third-party/middleware/nominatim/scripts/import-region.sh china
```

Use `monaco` for a small rebuild test, or pass a full `.osm.pbf` URL. Set
`NOMINATIM_RESET_DATA=1` to remove the existing local Nominatim data directory
before starting a fresh import.
