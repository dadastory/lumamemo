# Update Guide

This guide covers updating a Docker Compose based LumaMemo deployment.

## Before Updating

Back up configuration and runtime data:

```bash
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/$ts
cp -r data/ .env docker-compose.yml backups/$ts/
```

If you use external PostgreSQL, S3, OpenList, or Qdrant services, back them up with the tools provided by those services.

## Docker Compose Deployment

Pull the latest compose configuration and image, then restart:

```bash
git pull
docker compose pull
docker compose down
docker compose up -d
docker compose logs -f
```

If you use optional middleware or AI sidecar Compose files, start them with the same Compose command set you normally use for this deployment.

## Database Migration

The application runs database migrations during startup when configured for the deployment. Check logs after restart:

```bash
docker compose logs | grep -i migration
```

For manual local development flows:

```bash
pnpm db:migrate
```

## Verification Checklist

- Login works for the admin account and a normal user account.
- Existing photos, albums, faces, and AI analysis load.
- Upload works and storage quotas are enforced.
- Queue workers process thumbnail, EXIF, AI, and Live Photo tasks as expected.
- Public profile links still resolve after the update.
