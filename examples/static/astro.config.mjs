// @ts-check
import { fileURLToPath } from 'node:url'
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
  /*
   * Панель разработчика выключена: в сборке её нет, а в dev она висит поверх
   * страницы и грузится отдельным модулем. Стенды существуют ради сравнения
   * режимов — всё, чего нет в сборке, тут только мешает.
   */
  devToolbar: { enabled: false },
  vite: {
    plugins: [granum(granumConfig)],
    // Общий UI трёх стендов лежит рядом, а не внутри: алиас избавляет страницы
    // от счёта `../` и делает их одинаковыми во всех трёх.
    resolve: { alias: { '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
    /*
     * Два каталога выше — это корень репозитория: там `node_modules`, откуда
     * стенд берёт зависимости, и рядом `examples/shared` с общим UI. Vite не
     * отдаёт файлы выше корня своего проекта, и без этой строки dev-сервер
     * отвечает `403` на `/@fs/…`, а ни один остров не гидратируется. Сборка
     * при этом проходит: `/@fs/` — механизм только dev-сервера.
     */
    server: { fs: { allow: ['../..'] } },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'es'],
    routing: { prefixDefaultLocale: false },
  },
})
