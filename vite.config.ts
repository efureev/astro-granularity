import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Сборка интеграции, исполняемой в Node на этапе сборки сайта.
 *
 * `astro`, `vue` и сама библиотека остаются внешними: интеграция их только
 * настраивает, а версии выбирает потребитель.
 */
export default defineConfig({
  build: {
    target: 'esnext',
    minify: 'oxc',
    reportCompressedSize: true,
    emptyOutDir: true,
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        app: fileURLToPath(new URL('./src/app.ts', import.meta.url)),
        runtime: fileURLToPath(new URL('./src/runtime.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      // Всё, что резолвится у потребителя, остаётся внешним. Иначе
      // `@unocss/config` и `unplugin-vue-components` уезжают в бандл целиком:
      // 608 КБ на пакет, который только настраивает чужую сборку.
      external: [
        /^node:/,
        /^astro/,
        /^@astrojs\//,
        /^@feugene\//,
        /^@unocss\//,
        /^virtual:/,
        /^unplugin-vue-components/,
        'unocss',
        'vite',
        'vue',
      ],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
