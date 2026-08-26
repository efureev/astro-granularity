// @ts-check
import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import UnoCSS from 'unocss/astro'
import granularity from '@feugene/astro-granularity'

export default defineConfig({
  outDir: './dist',
  integrations: [
    vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
    UnoCSS({ injectReset: true }),
    granularity({ i18n: { locales: ['en', 'ru'] } }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
    routing: { prefixDefaultLocale: false },
  },
})
