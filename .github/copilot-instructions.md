# LumaMemo AI Coding Guidelines

LumaMemo is a self-hosted, multi-user AI photo management platform built with Nuxt 4. It extends the original ChronoFrame foundation with stronger security boundaries, PostgreSQL-backed multi-user management, optional AI services, RAW/Live Photo workflows, and multiple storage backends.

## Architecture Overview

- **Frontend**: Nuxt 4, Vue 3, TypeScript, Nuxt UI, Tailwind CSS.
- **Backend**: Nitro server APIs with Drizzle ORM and PostgreSQL as the default deployment database.
- **Storage**: `local`, S3-compatible storage, or OpenList through `server/services/storage`.
- **AI**: Optional VLM, Jina-compatible image embeddings, LocalAI face extraction, and Qdrant vector storage.
- **Processing**: Queue-based thumbnail, EXIF, geocoding, Live Photo, RAW asset, and AI tasks.
- **Image viewer**: Local `@lumamemo/webgl-image` package registered by `app/plugins/lumamemo-webgl-image.ts`.

## Key Directories

- `app/`: Nuxt app, pages, layouts, components, and composables.
- `server/`: API routes, database schema, settings, queues, storage, AI, image, and security services.
- `shared/`: Shared types and utility code.
- `packages/webgl-image/`: WebGL image viewer package.
- `third-party/ai/`: Optional Qdrant and LocalAI Compose stack.
- `third-party/middleware/`: Optional local map and geocoding Compose stack.

## Development Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm docs:build
pnpm db:generate
pnpm db:migrate
```

Use Docker Compose for local deployment:

```bash
docker compose up -d --build
```

Optional sidecars are started explicitly:

```bash
docker compose -f docker-compose.yml -f third-party/ai/docker-compose.yml up -d
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml up -d
```

## Database Pattern

Always use `useDB()` and schema helpers from `server/utils/db.ts`.

```ts
import { useDB, tables, eq } from '~~/server/utils/db'

const photo = await useDB()
  .select()
  .from(tables.photos)
  .where(eq(tables.photos.id, photoId))
  .get()
```

Do not import Drizzle clients directly in route handlers or services.

## Storage Pattern

All file operations go through the configured storage provider. Supported providers are:

- local filesystem
- S3-compatible object storage
- OpenList

Do not assume local disk paths for user photo objects unless the code is explicitly handling the local provider.

## AI Pattern

AI functionality is optional and split by capability:

- VLM analysis for tags, descriptions, and critique.
- Jina-compatible image embeddings for text-to-image search.
- LocalAI face extraction for face albums.
- Qdrant for vector storage.

AI stages must remain independently retryable. A failed VLM, embedding, or face stage should not block unrelated stages unless the caller explicitly requested a combined workflow.

## Security Pattern

- Keep admin capabilities separate from user-owned photo data.
- Scope photo, album, face, AI, upload, and public APIs by owner or explicit public visibility.
- When deleting users or generated AI data, clean associated storage artifacts and vector data.
- Preserve existing user changes; do not revert unrelated dirty worktree files.

## UI Pattern

- Match existing Nuxt UI and Tailwind conventions.
- Keep dashboard/admin tools dense, predictable, and work-focused.
- Hide AI-only UI when AI is disabled.
- Avoid hardcoded external project links unless the link is intentionally part of acknowledgements or documentation.
