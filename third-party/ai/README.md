# LumaMemo AI Services

This directory contains optional AI-side services used by LumaMemo.

LumaMemo does not install LocalAI models, download model files, edit model YAML,
or manage model runtime jobs. It stores provider URLs, API keys, and model names,
then performs lightweight health checks and inference requests.

Start these services explicitly when AI features need local sidecars:

```bash
docker compose -f docker-compose.yml -f third-party/ai/docker-compose.yml up -d
```

## Services

- **Qdrant** stores image vectors for semantic search.
- **LocalAI** is used for face extraction when face albums are enabled.
- **VLM providers** generate tags, descriptions, and photography critique.
- **Jina-compatible image embedding providers** power text-to-image search.

VLM, embedding, and face extraction can be enabled independently in the AI
settings. Leaving a feature disabled or unconfigured keeps the related UI and
tasks inactive.

## LocalAI Web UI

The bundled LocalAI service exposes its web UI on the host by default:

```text
http://localhost:18080/browse
```

Change the host port with `LOCALAI_PORT` in `.env`. Use the LocalAI web UI,
LocalAI CLI, or another official LocalAI workflow to install and manage face
models.

## LocalAI Model Directory

`third-party/ai/docker-compose.yml` mounts:

```bash
./data/ai/localai/models:/models
```

LocalAI owns the contents of that directory. After a face model is installed and
works in LocalAI, enter its model name in LumaMemo AI settings.

## Application Settings

LumaMemo only calls configured services:

- VLM: OpenAI-compatible or external provider configuration for visual analysis.
- Embedding: Jina-compatible image embedding API configuration for semantic search.
- Face extraction: LocalAI base URL plus face model name.

Model downloads, GPU/CPU tuning, galleries, mirrors, and model startup behavior
are handled outside LumaMemo.
