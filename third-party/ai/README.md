# ChronoFrame AI Services

This directory contains the optional AI-side Docker Compose file for Qdrant and
LocalAI.

ChronoFrame does not install LocalAI models, download model files, edit model
YAML, or poll LocalAI model jobs. It stores provider URLs and model names, then
calls the configured services.

## LocalAI Web UI

The bundled LocalAI service exposes its web UI on the host by default:

```text
http://localhost:18080/browse
```

Change the host port with `LOCALAI_PORT` in `.env`. Use the LocalAI web UI,
LocalAI CLI, or another official LocalAI workflow to install and manage models.

## LocalAI Model Directory

`third-party/ai/docker-compose.yml` mounts:

```bash
./data/ai/localai/models:/models
```

LocalAI owns the contents of that directory. After a model is installed and
works in LocalAI, enter its model name in ChronoFrame AI settings.

## ChronoFrame Settings

ChronoFrame only performs lightweight health checks and inference requests:

- VLM and semantic embedding providers can use OpenAI-compatible, OpenAI,
  LocalAI, or Ollama settings.
- Face extraction remains a LocalAI integration and uses the configured LocalAI
  base URL plus face model name.
- Model downloads, YAML tuning, GPU/CPU settings, mirrors, and galleries are
  handled outside ChronoFrame.
