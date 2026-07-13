# LumaMemo

<p align="center">
  <strong>自托管、多用户、AI 影像管理平台。</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</p>

**Languages:** [English](README.md) | 中文

LumaMemo 基于原始项目 [ChronoFrame](https://github.com/HoshinoSuzumi/chronoframe) 继续改造，面向家庭、团队和创作者提供私有化照片平台能力。当前版本在上游基础上增强了安全隔离、多用户管理、AI 影像理解、人脸相册、存储空间管理，以及 RAW/Live Photo 工作流。

## 事项进度

### 已完成

- [x] **照片管理** - 相册、元数据、地图视图、RAW 展示图、Live Photo 和 Motion Photo 支持。
- [x] **安全与多用户管理** - 用户隔离、权限感知接口、角色管理和安全删除用户。
- [x] **AI 影像理解** - 标签、描述、人脸相册、以文搜图和摄影评价。
- [x] **存储空间管理** - 本地/S3/OpenList 存储、单用户额度、上传限制和过期上传清理。
- [x] **本地部署栈** - PostgreSQL、Qdrant、可选 AI 服务和 Docker Compose 部署。

### 正在进行

- [ ] **AI 照片修复功能集成** - 增加基于 AI 的照片修复与增强工作流。

## 部署

复制环境变量模板，检查必要配置，然后启动 Compose 服务。默认 Compose 文件会使用已发布镜像 `dadastory/lumamemo:latest`。

```bash
cp .env.example .env
docker compose pull
docker compose up -d
```

公开访问服务前，至少需要设置安全的 `NUXT_SESSION_PASSWORD`。同时请根据实际环境检查管理员账号、存储、认证和地图配置。

可选 AI 和中间件服务请参考：

- [AI 服务](third-party/ai/README.md)
- [本地中间件](third-party/middleware/README.md)
- [配置指南](docs/zh/guide/configuration.md)

可选服务需要显式启动：

```bash
# AI 侧车：Qdrant 和 LocalAI
docker compose -f docker-compose.yml -f third-party/ai/docker-compose.yml up -d

# 本地地图和反向地理编码
docker compose -f docker-compose.yml -f third-party/middleware/docker-compose.yml up -d
```

## 使用指南

如果未配置 `LUMAMEMO_ADMIN_EMAIL` 和 `LUMAMEMO_ADMIN_PASSWORD`，默认管理员账号为：

- 邮箱：`admin@lumamemo.local`
- 密码：`LM1234@!`

登录后可在控制台上传照片、管理用户、配置存储额度、开启 AI 功能并查看队列结果。

AI 功能是可选能力。关闭 AI 总开关后，人脸相册和 AI 影像分析区域不会在界面中展示。

## 截图

![Gallery](./docs/images/screenshot1.png)
![Photo Detail](./docs/images/screenshot2.png)
![Map Explore](./docs/images/screenshot3.png)
![Dashboard](./docs/images/screenshot4.png)

## Star History

<!-- star-history:start -->
<!-- star-history:end -->

## 开发

本地开发环境和源码 Docker 构建说明请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 常用命令

```bash
pnpm install
cp .env.example .env
pnpm dev
pnpm build        # 构建生产版本
pnpm lint         # 静态检查
pnpm docs:build   # 构建文档
pnpm db:generate  # 生成迁移文件
pnpm db:migrate   # 执行迁移
```

## 项目结构

```text
lumamemo/
├── app/                    # Nuxt 应用、页面、组件和组合式函数
├── packages/
│   └── webgl-image/        # WebGL 图片查看器包
├── server/
│   ├── api/                # API 路由
│   ├── database/           # 数据库 schema 和迁移
│   └── services/           # 存储、AI、队列、图片和领域服务
├── shared/                 # 共享类型和工具
├── docs/                   # VitePress 文档
└── third-party/            # 可选 AI 和中间件 Compose 服务
```

## 致谢

LumaMemo 基于 Timothy Yin 的原始项目 [ChronoFrame](https://github.com/HoshinoSuzumi/chronoframe) 继续改造。感谢原作者和贡献者提供的项目基础。

本项目也依赖许多开源项目和生态，包括 Nuxt、Vue、TypeScript、Drizzle ORM、Nuxt UI、Tailwind CSS、Sharp、ExifTool、Qdrant、LocalAI、MapLibre GL、Mapbox GL、AWS SDK 与 S3 兼容存储、OpenList、OpenStreetMap 和 Nominatim。

## 许可证

本项目基于 MIT 协议发布。
