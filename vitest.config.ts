import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Виртуальные модули сборки Astro и granum в тестах — заглушками: точку
  // входа `./app` проверяют без настоящей сборки.
  resolve: {
    alias: {
      'virtual:granum/themes': fileURLToPath(new URL('./src/__tests__/stubs/granum-themes.ts', import.meta.url)),
      'virtual:granularity/theme': fileURLToPath(new URL('./src/__tests__/stubs/granularity-theme.ts', import.meta.url)),
      'virtual:granularity/i18n': fileURLToPath(new URL('./src/__tests__/stubs/granularity-i18n.ts', import.meta.url)),
    },
  },
  test: {
    // Ядро решает «сервер или браузер» при загрузке модуля; внешний пакет
    // `vi.resetModules()` не перечитывает, и тест сервера видел бы браузер.
    server: { deps: { inline: ['@feugene/granularity'] } },
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
