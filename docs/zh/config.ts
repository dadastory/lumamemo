import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'LumaMemo',
  description: '自托管、多用户、AI 影像管理平台',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '指南', link: '/zh/guide/getting-started' },
      { text: '开发文档', link: '/zh/development/contributing' },
    ],

    sidebar: [
      {
        text: '指南',
        items: [
          { text: '快速开始', link: '/zh/guide/getting-started' },
          { text: '配置说明', link: '/zh/guide/configuration' },
          { text: '升级指南', link: '/zh/guide/updates' },
        ],
      },
      {
        text: '配置',
        items: [
          { text: '存储提供器', link: '/zh/configuration/storage-providers' },
          { text: '地图提供器', link: '/zh/configuration/map-providers' },
          { text: '位置提供器', link: '/zh/configuration/location-providers' },
        ],
      },
      {
        text: '开发',
        items: [
          { text: '贡献指南', link: '/zh/development/contributing' },
          { text: 'API 文档', link: '/zh/development/api' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },
  },
})
