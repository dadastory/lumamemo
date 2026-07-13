import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'LumaMemo',
  description: 'Self-hosted multi-user AI photo platform',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  lastUpdated: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Development', link: '/development/contributing' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Update Guide', link: '/guide/updates' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          {
            text: 'Storage Providers',
            link: '/configuration/storage-providers',
          },
          { text: 'Map Providers', link: '/configuration/map-providers' },
          {
            text: 'Location Providers',
            link: '/configuration/location-providers',
          },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Contributing Guide', link: '/development/contributing' },
          { text: 'API Documentation', link: '/development/api' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © LumaMemo contributors',
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
    },
    zh: {
      label: '简体中文',
      lang: 'zh',
      link: '/zh/',
    },
  },

  ignoreDeadLinks: [/^http?:\/\/localhost/],
})
