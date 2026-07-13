# 升级指南

本文介绍如何升级基于 Docker Compose 部署的 LumaMemo。

## 升级前

先备份配置和运行数据：

```bash
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/$ts
cp -r data/ .env docker-compose.yml backups/$ts/
```

如果你使用外部 PostgreSQL、S3、OpenList 或 Qdrant 服务，请使用对应服务的工具完成备份。

## Docker Compose 部署

拉取最新 Compose 配置和镜像，然后重启：

```bash
git pull
docker compose pull
docker compose down
docker compose up -d
docker compose logs -f
```

如果你使用可选中间件或 AI 侧车 Compose 文件，请按当前部署实际使用的 Compose 命令一起启动。

## 数据库迁移

部署配置启用后，应用会在启动时执行数据库迁移。重启后检查日志：

```bash
docker compose logs | grep -i migration
```

本地开发时也可以手动执行：

```bash
pnpm db:migrate
```

## 验证清单

- 管理员账号和普通用户账号都可以登录。
- 旧照片、相册、人脸和 AI 分析内容可以正常加载。
- 上传可用，且存储空间额度会被正确校验。
- 队列能处理缩略图、EXIF、AI 和 Live Photo 任务。
- 公开主页链接在升级后仍可访问。
