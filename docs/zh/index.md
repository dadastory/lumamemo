---
layout: home

hero:
  name: 'LumaMemo'
  text: '自托管 AI 影像平台'
  tagline: '面向多用户的私有照片管理，支持安全隔离、以文搜图、人脸相册、存储额度、RAW 增强和 AI 摄影评价。'
  image:
    src: /logo.png
    alt: LumaMemo
    style: 'filter: drop-shadow(0 0 30px rgba(168, 85, 247, 0.7)) drop-shadow(0 0 60px rgba(59, 130, 246, 0.5)) drop-shadow(0 0 100px rgba(168, 85, 247, 0.3)); width: 300px; height: 300px;'
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 配置说明
      link: /zh/guide/configuration

features:
  - title: 安全的多用户照片库
    icon: 🔐
    details: 用户数据隔离、管理员管理、公开可见性控制，以及按权限校验的照片接口。
  - title: AI 影像理解
    icon: ✨
    details: 可选的视觉标签、描述、以文搜图、摄影评价，以及可独立重试的 AI 任务。
  - title: 人脸相册
    icon: 👤
    details: 基于 LocalAI 的人脸提取、人物聚合、人物命名、可见性控制和照片详情人脸裁剪图。
  - title: 存储空间额度
    icon: 💾
    details: 系统默认额度、单用户额度、上传前容量拦截和过期上传记录清理。
  - title: RAW 与 Live Photo
    icon: 🎞️
    details: RAW 展示图、主图切换、方向变更后的重新处理、Live Photo 和 Motion Photo 支持。
  - title: 灵活基础设施
    icon: 🧩
    details: 支持 PostgreSQL、Qdrant、本地/S3/OpenList 存储、Mapbox 或 MapLibre，以及可选外部 AI 服务。
---

## 文档

- 从 [快速开始](/zh/guide/getting-started) 了解本地 Compose 部署。
- 启用存储、地图、认证或 AI 服务前，请阅读 [配置说明](/zh/guide/configuration)。
- 通过 [存储提供器](/zh/configuration/storage-providers) 选择本地文件系统、S3 兼容存储或 OpenList。

## 许可证

LumaMemo 基于 MIT 协议发布。
