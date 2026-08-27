// @ts-check
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import { defineConfig } from 'astro/config'
import UnoCSS from 'unocss/astro'

export default defineConfig({
  // Нужен канонической ссылке, `hreflang` и карте сайта: без него абсолютный
  // адрес страницы построить не из чего.
  site: 'https://astro-granularity.example',
  outDir: './dist',
  integrations: [
    vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
    UnoCSS({ injectReset: true }),
    granularity({ i18n: {
      packages: ['@feugene/granularity-chrono'],
      locales: ['en', 'ru', 'es'],
    } }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'es'],
    routing: { prefixDefaultLocale: false },
  },
})
