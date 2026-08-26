import { defineConfig, devices } from '@playwright/test'

/**
 * Оба гейта работают на собранном превью — на том, что реально уезжает
 * потребителю.
 *
 * Расхождения гидратации отсюда **не видны**: Vue вырезает эти предупреждения
 * из production-сборки. Отдельный dev-сервер под них не заведён потому, что
 * `astro dev` в этом проекте не стартует вовсе («Dev server process exited
 * before becoming ready», Astro 7.2.7 / Node 26) — см. `.claude/docs/gotchas.md`.
 * Пока это так, гейт проверяет серверную разметку и интерактив, но не совпадение
 * первого клиентского рендера с серверным.
 */
const PORT = Number(process.env.E2E_PORT ?? 4331)

const OVERLAYS = /overlays\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'on-first-retry',
  },

  projects: [
    // `channel: 'chromium'` — полный сборочный chromium вместо headless-shell:
    // shell не отдаёт кадры `Page.startScreencast`, а гейт первого кадра на них
    // и держится. Без канала тест «проходит» на нуле кадров.
    {
      name: 'chromium-dark',
      testIgnore: OVERLAYS,
      use: { ...devices['Desktop Chrome'], channel: 'chromium', colorScheme: 'dark' },
    },
    {
      name: 'chromium-light',
      testIgnore: OVERLAYS,
      use: { ...devices['Desktop Chrome'], channel: 'chromium', colorScheme: 'light' },
    },
    {
      name: 'overlays',
      testMatch: OVERLAYS,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],

  // `astro preview` здесь не годится: в Astro 7.2.7 он демонизируется и
  // возвращает управление сразу — Playwright видит упавший процесс, а демон
  // остаётся жить и отдавать старую сборку. Подробности — в `e2e/serve.mjs`.
  //
  // `reuseExistingServer: false` намеренно: переиспользование чужого сервера и
  // есть тот механизм, которым гейт молча начинал проверять не ту сборку.
  // Занятый порт теперь роняет прогон громко.
  webServer: {
    command: `npx astro build && node ../e2e/serve.mjs ${PORT} dist`,
    cwd: './example',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
