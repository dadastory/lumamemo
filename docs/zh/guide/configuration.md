# 配置项说明

配置通过 `.env` 提供。建议从 `.env.example` 复制后按部署环境调整。

## 必需运行配置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_SESSION_PASSWORD` | 必填，32 位以上会话加密密钥 | 无 |
| `LUMAMEMO_ADMIN_EMAIL` | 初始管理员邮箱 | `admin@lumamemo.local` |
| `LUMAMEMO_ADMIN_NAME` | 初始管理员用户名 | `LumaMemo` |
| `LUMAMEMO_ADMIN_PASSWORD` | 初始管理员密码 | `LM1234@!` |
| `NUXT_PUBLIC_COLOR_MODE_PREFERENCE` | `light`、`dark` 或 `system` | `light` |
| `NUXT_ALLOW_INSECURE_COOKIE` | 开发环境非 HTTPS Cookie 开关 | `false` |

## 数据库

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DATABASE_PROVIDER` | `postgres` 或 `sqlite`；Compose 默认使用 PostgreSQL | `postgres` |
| `DATABASE_URL` | 应用数据库连接串 | PostgreSQL 侧车地址 |
| `POSTGRES_IMAGE` | PostgreSQL 侧车镜像 | `postgres:17` |
| `POSTGRES_DB` | PostgreSQL 数据库名 | `lumamemo` |
| `POSTGRES_USER` | PostgreSQL 用户名 | `lumamemo` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | `lumamemo-postgres-password` |

## 认证

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_PUBLIC_OAUTH_GITHUB_ENABLED` | 启用 GitHub 登录 | `false` |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth Client ID | 无 |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | 无 |
| `NUXT_PUBLIC_OAUTH_OIDC_ENABLED` | 启用 OIDC 登录 | `false` |
| `NUXT_PUBLIC_OAUTH_OIDC_LABEL` | OIDC 按钮显示名称 | `OIDC` |
| `NUXT_OAUTH_OIDC_ISSUER` | OIDC issuer URL | 无 |
| `NUXT_OAUTH_OIDC_CLIENT_ID` | OIDC Client ID | 无 |
| `NUXT_OAUTH_OIDC_CLIENT_SECRET` | OIDC Client Secret | 无 |
| `NUXT_OAUTH_OIDC_SCOPE` | OIDC scope | `openid email profile` |
| `NUXT_OAUTH_OIDC_CLIENT_AUTH_METHOD` | OIDC 客户端认证方式 | `client_secret_post` |

## 地图与位置

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_PUBLIC_MAP_PROVIDER` | `maplibre` 或 `mapbox` | `maplibre` |
| `NUXT_PUBLIC_MAP_MAPLIBRE_STYLE` | MapLibre 样式地址 | `/maps/style.json?v=global` |
| `NUXT_PUBLIC_MAP_MAPLIBRE_TOKEN` | 可选 MapLibre token | 无 |
| `NUXT_PUBLIC_MAP_MAPBOX_STYLE` | Mapbox 样式地址 | `mapbox://styles/mapbox/standard` |
| `NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | 前端 Mapbox token | 无 |
| `NUXT_MAPBOX_ACCESS_TOKEN` | 服务端 Mapbox 地理编码 token | 无 |
| `NUXT_NOMINATIM_BASE_URL` | 可选 Nominatim 地址 | 无 |

本地地图和地理编码侧车使用 `PMTILES_IMAGE`、`PMTILES_TILESET`、`PMTILES_FILENAME`、`MAPLIBRE_IMAGE` 和 `NOMINATIM_*`。

## 存储

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_STORAGE_PROVIDER` | `local`、`s3` 或 `openlist` | `s3` |
| `NUXT_PROVIDER_LOCAL_PATH` | 应用容器内本地存储路径 | `/app/data/storage` |
| `NUXT_PROVIDER_LOCAL_BASE_URL` | 本地存储公开路由 | `/storage` |
| `NUXT_PROVIDER_S3_ENDPOINT` | S3 兼容 endpoint | `http://minio:9000` |
| `NUXT_PROVIDER_S3_BUCKET` | S3 bucket | `lumamemo` |
| `NUXT_PROVIDER_S3_REGION` | S3 region | `us-east-1` |
| `NUXT_PROVIDER_S3_ACCESS_KEY_ID` | S3 access key | `lumamemo` |
| `NUXT_PROVIDER_S3_SECRET_ACCESS_KEY` | S3 secret key | `lumamemo-minio-password` |
| `NUXT_PROVIDER_S3_PREFIX` | S3 对象前缀 | `photos/` |
| `NUXT_PROVIDER_S3_CDN_URL` | 可选 CDN 地址 | 无 |
| `NUXT_PROVIDER_S3_FORCE_PATH_STYLE` | 强制 path-style S3 URL | `true` |
| `NUXT_PROVIDER_OPENLIST_BASE_URL` | OpenList 基础地址 | 无 |
| `NUXT_PROVIDER_OPENLIST_ROOT_PATH` | OpenList 根路径 | 无 |
| `NUXT_PROVIDER_OPENLIST_TOKEN` | OpenList token | 无 |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_UPLOAD` | OpenList 上传端点 | `/api/fs/put` |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_DOWNLOAD` | OpenList 下载端点 | 无 |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_LIST` | OpenList 列表端点 | 无 |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_DELETE` | OpenList 删除端点 | `/api/fs/remove` |
| `NUXT_PROVIDER_OPENLIST_ENDPOINT_META` | OpenList 元数据端点 | `/api/fs/get` |
| `NUXT_PROVIDER_OPENLIST_PATH_FIELD` | OpenList 路径字段名 | `path` |
| `NUXT_PROVIDER_OPENLIST_CDN_URL` | 可选 OpenList CDN 地址 | 无 |

内置 MinIO 侧车使用 `MINIO_IMAGE`、`MINIO_MC_IMAGE`、`MINIO_ROOT_USER`、`MINIO_ROOT_PASSWORD` 和 `MINIO_BUCKET`。

## AI 服务

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `ML_LOCALAI_BASE_URL` | 人脸提取使用的 LocalAI 地址 | `http://lumamemo-localai:8080` |
| `ML_FACE_MODEL` | LocalAI 人脸模型名称 | 无 |
| `ML_VLM_PROVIDER` | VLM 供应商类型 | `openai-compatible` |
| `ML_VLM_BASE_URL` | VLM API 地址 | 无 |
| `ML_VLM_API_KEY` | VLM API key | 无 |
| `ML_VLM_MODEL` | VLM 模型名称 | 无 |
| `ML_EMBEDDING_BASE_URL` | Jina 兼容图像 embedding 地址 | `https://api.jina.ai/v1` |
| `ML_EMBEDDING_API_KEY` | embedding API key | 无 |
| `ML_EMBEDDING_MODEL` | embedding 模型名称 | 无 |
| `ML_VECTOR_PROVIDER` | 向量库供应商 | `qdrant` |
| `ML_VECTOR_BASE_URL` | Qdrant 地址 | `http://lumamemo-qdrant:6333` |
| `ML_VECTOR_API_KEY` | 可选 Qdrant API key | 无 |
| `ML_VECTOR_COLLECTION_PREFIX` | Qdrant collection 前缀 | `lumamemo` |

AI 侧车使用 `QDRANT_IMAGE`、`LOCALAI_IMAGE`、`LOCALAI_PORT`、`LOCALAI_DEBUG`、`LOCALAI_DISABLE_HARDWARE_DEFAULTS`、`LOCALAI_MAX_ACTIVE_BACKENDS`、`LOCALAI_WATCHDOG_*` 和 `HF_ENDPOINT`。

## 上传校验

| 环境变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_UPLOAD_MIME_WHITELIST_ENABLED` | 启用 MIME 白名单校验 | `true` |
| `NUXT_UPLOAD_MIME_WHITELIST` | 逗号分隔的 MIME 白名单 | 见 `.env.example` |

默认白名单包含常见图片格式、RAW 相机格式、`video/quicktime` 和 `video/mp4`。
