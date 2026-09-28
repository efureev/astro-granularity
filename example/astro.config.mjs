// @ts-check
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import { granum } from '@feugene/granum/vite'
import { defineConfig } from 'astro/config'
import granumConfig from './granum.config.mjs'

export default defineConfig({
  // Нужен канонической ссылке, `hreflang` и карте сайта: без него абсолютный
  // адрес страницы построить не из чего.
  site: 'https://astro-granularity.example',
  outDir: './dist',
  integrations: [
    vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
    granularity({ i18n: {
      packages: ['@feugene/granularity-chrono'],
      locales: ['en', 'ru', 'es'],
    } }),
  ],
  // Плагин регистрирует приложение, а не интеграция: granum — обычный плагин
  // Vite, и его версия остаётся делом потребителя. Интеграция знает про него
  // одну строку — имя — и падает, если плагина нет.
  vite: { plugins: [granum(granumConfig)] },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'es'],
    routing: { prefixDefaultLocale: false },
  },
})
