# LumaMemo

<p align="center">
  <strong>Self-hosted, multi-user AI photo management platform.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</p>

**Languages:** English | [中文](README_zh.md)

LumaMemo is a private photo platform for families, teams, and creators, built on the original [ChronoFrame](https://github.com/HoshinoSuzumi/chronoframe) project. It extends the upstream foundation with stronger security controls, multi-user administration, AI-assisted photo understanding, face albums, storage quota management, and enhanced RAW/Live Photo workflows.

## Status

### Completed

- [x] **Photo management** - Albums, metadata, map views, RAW assets, Live Photo, and Motion Photo support.
- [x] **Security and multi-user administration** - User isolation, permission-aware APIs, role management, and safe user deletion.
- [x] **AI photo understanding** - Tags, descriptions, face albums, text-to-image search, and photography critique.
- [x] **Storage management** - Local/S3/OpenList storage, per-user quotas, upload limits, and stale upload cleanup.
- [x] **Local deployment stack** - PostgreSQL, Qdrant, optional AI services, and Docker Compose based setup.

### In Progress

- [ ] **AI photo restoration integration** - Add AI-powered photo repair and enhancement workflows.

## Deployment

Copy the environment template, review the required values, then start the Compose stack. The default compose file uses the published Docker image `dadastory/lumamemo:latest`.

```bash
cp .env.example .env
docker compose pull
docker compose up -d
```

At minimum, set a strong `NUXT_SESSION_PASSWORD` before exposing the service. Review administrator, storage, authentication, and map settings in `.env` for your environment.

For optional AI and middleware services, review:

- [AI services](third-party/ai/README.md)
- [Local middleware](third-party/middleware/README.md)
- [Configuration guide](docs/guide/configuration.md)

Optional services are started explicitly:

```bash
# AI sidecars: Qdrant and LocalAI
docker compose -f docker-compose.yml -f third-party/ai/docker-compose.yml up -d

# Local maps and reverse geocoding
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml up -d
```

## User Guide

If `LUMAMEMO_ADMIN_EMAIL` and `LUMAMEMO_ADMIN_PASSWORD` are not set, the default admin account is:

- Email: `admin@lumamemo.local`
- Password: `LM1234@!`

After signing in, use the dashboard to upload photos, manage users, configure storage quotas, enable AI features, and review queue results.

AI features are optional. When the AI switch is disabled, face albums and AI analysis sections are hidden from the user interface.

## Screenshots

![Gallery](./docs/images/screenshot1.png)
![Photo Detail](./docs/images/screenshot2.png)
![Map Explore](./docs/images/screenshot3.png)
![Dashboard](./docs/images/screenshot4.png)

## Star History

<!-- star-history:start -->
<!-- star-history:end -->

## Development

For local development setup, including source-built Docker usage, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Common Commands

```bash
pnpm install
cp .env.example .env
pnpm dev
pnpm build        # Production build
pnpm lint         # Static lint check
pnpm docs:build   # Build documentation
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Run migrations
```

## Project Structure

```text
lumamemo/
├── app/                    # Nuxt app, pages, components, composables
├── packages/
│   └── webgl-image/        # WebGL image viewer package
├── server/
│   ├── api/                # API routes
│   ├── database/           # Database schema and migrations
│   └── services/           # Storage, AI, queue, image, and domain services
├── shared/                 # Shared types and utilities
├── docs/                   # VitePress documentation
└── third-party/            # Optional AI and middleware Compose stacks
```

## Acknowledgements

LumaMemo builds on the original [ChronoFrame](https://github.com/HoshinoSuzumi/chronoframe) project by Timothy Yin. Thanks to the original author and contributors for the foundation this project extends.

This project also depends on many open-source projects and ecosystems, including Nuxt, Vue, TypeScript, Drizzle ORM, Nuxt UI, Tailwind CSS, Sharp, ExifTool, Qdrant, LocalAI, MapLibre GL, Mapbox GL, AWS SDK and S3-compatible storage, OpenList, OpenStreetMap, and Nominatim.

## License

This project is distributed under the MIT License.
