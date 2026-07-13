---
layout: home

hero:
  name: 'LumaMemo'
  text: 'Self-hosted AI Photo Platform'
  tagline: 'Private multi-user photo management with security controls, semantic search, face albums, storage quotas, RAW support, and AI critique.'
  image:
    src: /logo.png
    alt: LumaMemo
    style: 'filter: drop-shadow(0 0 30px rgba(168, 85, 247, 0.7)) drop-shadow(0 0 60px rgba(59, 130, 246, 0.5)) drop-shadow(0 0 100px rgba(168, 85, 247, 0.3)); width: 300px; height: 300px;'
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: Configuration
      link: /guide/configuration

features:
  - title: Secure Multi-User Library
    icon: 🔐
    details: User isolation, admin management, public visibility controls, and permission-aware photo APIs.
  - title: AI Photo Understanding
    icon: ✨
    details: Optional visual tags, descriptions, text-to-image search, photography critique, and independent retryable AI tasks.
  - title: Face Albums
    icon: 👤
    details: LocalAI-based face extraction, people grouping, person naming, visibility controls, and face crops in photo details.
  - title: Storage Quotas
    icon: 💾
    details: System default quotas, per-user storage limits, upload blocking, and stale pending-upload cleanup.
  - title: RAW and Live Photo
    icon: 🎞️
    details: RAW display assets, primary-image switching, orientation-aware reprocessing, Live Photo, and Motion Photo handling.
  - title: Flexible Infrastructure
    icon: 🧩
    details: PostgreSQL, Qdrant, local/S3/OpenList storage, Mapbox or MapLibre maps, and optional external AI services.
---

## Documentation

- Start with [Getting Started](/guide/getting-started) for local Compose deployment.
- Review [Configuration](/guide/configuration) before enabling storage, maps, authentication, or AI services.
- Use [Storage Providers](/configuration/storage-providers) to choose local filesystem, S3-compatible storage, or OpenList.

## License

LumaMemo is distributed under the MIT License.
