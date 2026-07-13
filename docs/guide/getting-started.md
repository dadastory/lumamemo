# Getting Started

This guide walks through running LumaMemo with Docker Compose and the published application image.

## Prerequisites

- Docker with Compose support.
- Node.js 18+ and pnpm 9+ if you plan to run the app in development mode.
- A storage backend: local filesystem, S3-compatible storage, or OpenList.
- PostgreSQL for application data. Optional AI features also use Qdrant and external AI model services.

## Quick Deployment

### 1. Create `.env`

Copy the checked-in template and review the values:

```bash
cp .env.example .env
```

For a local filesystem setup, keep:

```bash
NUXT_STORAGE_PROVIDER=local
NUXT_PROVIDER_LOCAL_PATH=/app/data/storage
```

For S3-compatible storage, configure:

```bash
NUXT_STORAGE_PROVIDER=s3
NUXT_PROVIDER_S3_ENDPOINT=
NUXT_PROVIDER_S3_BUCKET=lumamemo
NUXT_PROVIDER_S3_REGION=auto
NUXT_PROVIDER_S3_ACCESS_KEY_ID=
NUXT_PROVIDER_S3_SECRET_ACCESS_KEY=
NUXT_PROVIDER_S3_PREFIX=photos/
NUXT_PROVIDER_S3_CDN_URL=
```

For OpenList, configure:

```bash
NUXT_STORAGE_PROVIDER=openlist
NUXT_PROVIDER_OPENLIST_BASE_URL=https://openlist.example.com
NUXT_PROVIDER_OPENLIST_ROOT_PATH=/115pan/lumamemo
NUXT_PROVIDER_OPENLIST_TOKEN=your-static-token
```

Set a strong session password:

```bash
NUXT_SESSION_PASSWORD=
```

Optional GitHub OAuth variables:

```bash
NUXT_PUBLIC_OAUTH_GITHUB_ENABLED=true
NUXT_OAUTH_GITHUB_CLIENT_ID=
NUXT_OAUTH_GITHUB_CLIENT_SECRET=
```

Set the OAuth callback URL in GitHub to:

```text
http(s)://<your-domain>/api/auth/github
```

### 2. Start the Stack

Use the Compose files from this repository. The default application image is `dadastory/lumamemo:latest`:

```bash
docker compose pull
docker compose up -d
```

Follow logs:

```bash
docker compose logs -f
```

Stop services:

```bash
docker compose down
```

## Optional AI Services

AI features are disabled unless configured in the application settings.

- Qdrant stores image vectors.
- VLM providers generate tags, descriptions, and critique.
- Jina-compatible image embedding providers power semantic search.
- LocalAI is used for face extraction when enabled.

Start AI sidecars only when you need them:

```bash
docker compose -f docker-compose.yml -f third-party/ai/docker-compose.yml up -d
```

See `third-party/ai/README.md` for details.

## Optional Local Maps and Geocoding

Local MapLibre, PMTiles, and Nominatim services are optional:

```bash
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml up -d
```

See `third-party/middleware/README.md` for data import commands.

## Development Mode

For source-built Docker development, see [Contributing](../development/contributing.md).

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

## Reverse Proxy

For production, place LumaMemo behind Nginx, Caddy, Traefik, or another reverse proxy for HTTPS termination.

Nginx example:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Common Issues

### How do I generate `NUXT_SESSION_PASSWORD`?

```bash
openssl rand -base64 32
```

### Why are AI features hidden?

AI sections are hidden when the AI feature switch is disabled. Enable AI in the dashboard settings, then configure and test the VLM, embedding, and face providers you want to use.
