# Configuration Reference

Configuration is provided through `.env`. Start from `.env.example`, then adjust values for your deployment.

## Required Runtime Settings

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_SESSION_PASSWORD` | Required 32+ character session encryption secret | none |
| `LUMAMEMO_ADMIN_EMAIL` | Initial admin email | `admin@lumamemo.local` |
| `LUMAMEMO_ADMIN_NAME` | Initial admin username | `LumaMemo` |
| `LUMAMEMO_ADMIN_PASSWORD` | Initial admin password | `LM1234@!` |
| `NUXT_PUBLIC_COLOR_MODE_PREFERENCE` | `light`, `dark`, or `system` | `light` |
| `NUXT_ALLOW_INSECURE_COOKIE` | Development-only insecure cookie override | `false` |

## Database

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_PROVIDER` | `postgres` or `sqlite`; Compose defaults to PostgreSQL | `postgres` |
| `DATABASE_URL` | Application database connection string | PostgreSQL sidecar URL |
| `POSTGRES_IMAGE` | PostgreSQL sidecar image | `postgres:17` |
| `POSTGRES_DB` | PostgreSQL database name | `lumamemo` |
| `POSTGRES_USER` | PostgreSQL username | `lumamemo` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `lumamemo-postgres-password` |

## Authentication

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_PUBLIC_OAUTH_GITHUB_ENABLED` | Enable GitHub login | `false` |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth client ID | none |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | none |
| `NUXT_PUBLIC_OAUTH_OIDC_ENABLED` | Enable OIDC login | `false` |
| `NUXT_PUBLIC_OAUTH_OIDC_LABEL` | OIDC button label | `OIDC` |
| `NUXT_OAUTH_OIDC_ISSUER` | OIDC issuer URL | none |
| `NUXT_OAUTH_OIDC_CLIENT_ID` | OIDC client ID | none |
| `NUXT_OAUTH_OIDC_CLIENT_SECRET` | OIDC client secret | none |
| `NUXT_OAUTH_OIDC_SCOPE` | OIDC scope | `openid email profile` |
| `NUXT_OAUTH_OIDC_CLIENT_AUTH_METHOD` | OIDC client auth method | `client_secret_post` |

## Maps and Location

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_PUBLIC_MAP_PROVIDER` | `maplibre` or `mapbox` | `maplibre` |
| `NUXT_PUBLIC_MAP_MAPLIBRE_STYLE` | MapLibre style URL | `/maps/style.json?v=global` |
| `NUXT_PUBLIC_MAP_MAPLIBRE_TOKEN` | Optional MapLibre token | none |
| `NUXT_PUBLIC_MAP_MAPBOX_STYLE` | Mapbox style URL | `mapbox://styles/mapbox/standard` |
| `NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Public Mapbox token | none |
| `NUXT_MAPBOX_ACCESS_TOKEN` | Server-side Mapbox geocoding token | none |
| `NUXT_NOMINATIM_BASE_URL` | Optional Nominatim base URL | none |

Local map and geocoding sidecars use `PMTILES_IMAGE`, `PMTILES_TILESET`, `PMTILES_FILENAME`, `MAPLIBRE_IMAGE`, and `NOMINATIM_*`.

## Storage

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_STORAGE_PROVIDER` | `local`, `s3`, or `openlist` | `s3` |
| `NUXT_PROVIDER_LOCAL_PATH` | Local storage path inside the app container | `/app/data/storage` |
| `NUXT_PROVIDER_LOCAL_BASE_URL` | Local storage public route | `/storage` |
| `NUXT_PROVIDER_S3_ENDPOINT` | S3-compatible endpoint | `http://minio:9000` |
| `NUXT_PROVIDER_S3_BUCKET` | S3 bucket | `lumamemo` |
| `NUXT_PROVIDER_S3_REGION` | S3 region | `us-east-1` |
| `NUXT_PROVIDER_S3_ACCESS_KEY_ID` | S3 access key | `lumamemo` |
| `NUXT_PROVIDER_S3_SECRET_ACCESS_KEY` | S3 secret key | `lumamemo-minio-password` |
| `NUXT_PROVIDER_S3_PREFIX` | S3 object prefix | `photos/` |
| `NUXT_PROVIDER_S3_CDN_URL` | Optional public CDN URL | none |
| `NUXT_PROVIDER_S3_FORCE_PATH_STYLE` | Force path-style S3 URLs | `true` |
| `NUXT_PROVIDER_OPENLIST_BASE_URL` | OpenList base URL | none |
| `NUXT_PROVIDER_OPENLIST_ROOT_PATH` | OpenList root path | none |
| `NUXT_PROVIDER_OPENLIST_TOKEN` | OpenList token | none |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_UPLOAD` | OpenList upload endpoint | `/api/fs/put` |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_DOWNLOAD` | OpenList download endpoint | none |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_LIST` | OpenList list endpoint | none |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_DELETE` | OpenList delete endpoint | `/api/fs/remove` |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_META` | OpenList metadata endpoint | `/api/fs/get` |
| `NUXT_PROVIDER_OPENLIST_PATH_FIELD` | OpenList path field | `path` |
| `NUXT_PROVIDER_OPENLIST_CDN_URL` | Optional OpenList CDN URL | none |

The bundled MinIO sidecar uses `MINIO_IMAGE`, `MINIO_MC_IMAGE`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, and `MINIO_BUCKET`.

## AI Services

| Variable | Description | Default |
| --- | --- | --- |
| `ML_LOCALAI_BASE_URL` | LocalAI base URL for face extraction | `http://lumamemo-localai:8080` |
| `ML_FACE_MODEL` | LocalAI face model name | none |
| `ML_VLM_PROVIDER` | VLM provider type | `openai-compatible` |
| `ML_VLM_BASE_URL` | VLM API base URL | none |
| `ML_VLM_API_KEY` | VLM API key | none |
| `ML_VLM_MODEL` | VLM model name | none |
| `ML_EMBEDDING_BASE_URL` | Jina-compatible image embedding base URL | `https://api.jina.ai/v1` |
| `ML_EMBEDDING_API_KEY` | Embedding API key | none |
| `ML_EMBEDDING_MODEL` | Embedding model name | none |
| `ML_VECTOR_PROVIDER` | Vector store provider | `qdrant` |
| `ML_VECTOR_BASE_URL` | Qdrant base URL | `http://lumamemo-qdrant:6333` |
| `ML_VECTOR_API_KEY` | Optional Qdrant API key | none |
| `ML_VECTOR_COLLECTION_PREFIX` | Qdrant collection prefix | `lumamemo` |

AI sidecars use `QDRANT_IMAGE`, `LOCALAI_IMAGE`, `LOCALAI_PORT`, `LOCALAI_DEBUG`, `LOCALAI_DISABLE_HARDWARE_DEFAULTS`, `LOCALAI_MAX_ACTIVE_BACKENDS`, `LOCALAI_WATCHDOG_*`, and `HF_ENDPOINT`.

## Upload Validation

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_UPLOAD_MIME_WHITELIST_ENABLED` | Enable MIME whitelist validation | `true` |
| `NUXT_UPLOAD_MIME_WHITELIST` | Comma-separated allowed MIME types | See `.env.example` |

The default whitelist includes common image formats, RAW camera formats, `video/quicktime`, and `video/mp4`.
