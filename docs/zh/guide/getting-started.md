# 快速开始

本文介绍如何通过 Docker Compose 和已发布应用镜像运行 LumaMemo。

## 前置准备

- 可用的 Docker 与 Compose。
- 如需本地开发，准备 Node.js 18+ 和 pnpm 9+。
- 一个存储后端：本地文件系统、S3 兼容存储或 OpenList。
- PostgreSQL 用于应用数据。可选 AI 功能还会使用 Qdrant 和外部 AI 模型服务。

## 快速部署

### 1. 创建 `.env`

复制仓库中的环境变量模板并检查配置：

```bash
cp .env.example .env
```

使用本地文件系统存储时，保留：

```bash
NUXT_STORAGE_PROVIDER=local
NUXT_PROVIDER_LOCAL_PATH=/app/data/storage
```

使用 S3 兼容存储时，配置：

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

使用 OpenList 时，配置：

```bash
NUXT_STORAGE_PROVIDER=openlist
NUXT_PROVIDER_OPENLIST_BASE_URL=https://openlist.example.com
NUXT_PROVIDER_OPENLIST_ROOT_PATH=/115pan/lumamemo
NUXT_PROVIDER_OPENLIST_TOKEN=your-static-token
```

设置安全的会话密码：

```bash
NUXT_SESSION_PASSWORD=
```

可选 GitHub OAuth 变量：

```bash
NUXT_PUBLIC_OAUTH_GITHUB_ENABLED=true
NUXT_OAUTH_GITHUB_CLIENT_ID=
NUXT_OAUTH_GITHUB_CLIENT_SECRET=
```

GitHub OAuth 回调地址设置为：

```text
http(s)://<你的域名>/api/auth/github
```

### 2. 启动服务

使用当前仓库中的 Compose 文件。默认应用镜像为 `dadastory/lumamemo:latest`：

```bash
docker compose pull
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

## 可选 AI 服务

AI 功能默认不会强制启用，需要在应用设置中配置后使用。

- Qdrant 用于保存图像向量。
- VLM 服务用于生成标签、描述和摄影评价。
- Jina 兼容的图像 embedding 服务用于以文搜图。
- 启用人脸提取时使用 LocalAI。

需要时再启动 AI 侧车：

```bash
docker compose -f docker-compose.yml -f third-party/ai/docker-compose.yml up -d
```

详情请参考 `third-party/ai/README.md`。

## 可选本地地图与地理编码

本地 MapLibre、PMTiles 和 Nominatim 服务是可选服务：

```bash
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml up -d
```

数据导入命令请参考 `third-party/middleware/README.md`。

## 本地开发

如需基于源码进行 Docker 开发，请参考[开始贡献](../development/contributing.md)。

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm dev
```

构建生产版本：

```bash
pnpm build
```

## 反向代理

生产部署时建议使用 Nginx、Caddy、Traefik 或其他反向代理处理 HTTPS。

Nginx 示例：

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

## 常见问题

### 如何生成 `NUXT_SESSION_PASSWORD`？

```bash
openssl rand -base64 32
```

### 为什么 AI 功能没有展示？

关闭 AI 总开关时，AI 影像分析和人脸区域会隐藏。需要在控制台设置中开启 AI，并配置和测试要使用的 VLM、embedding 与人脸服务。
