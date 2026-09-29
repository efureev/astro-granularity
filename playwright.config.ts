import { defineConfig, devices } from '@playwright/test'

/**
 * Четыре сервера на один прогон: три стенда и dev-режим.
 *
 * Стенды `examples/{static,ssr,hybrid}` делят весь UI — он лежит в
 * `examples/shared`, — и различаются только режимом вывода Astro. Поэтому
 * расхождение между ними не может быть разницей приложений: это всегда разница
 * режима, и `parity.spec.ts` держит именно её.
 *
 * Dev поднимается над тем же статическим стендом. Отдельный сервер ему нужен
 * потому, что гейты выше работают по собранному `dist/`, а часть дефектов живёт
 * только в dev: `/@fs/` вне корня, расхождения гидратации (Vue сообщает о них
 * лишь в dev-сборке), HMR-клиент в разметке.
 */
const PORT = Number(process.env.E2E_PORT ?? 4331)
export const PORTS = { static: PORT, ssr: PORT + 1, hybrid: PORT + 2, dev: PORT + 3 }

const FIRST_PAINT = /first-paint\.spec\.ts/
const OVERLAYS = /overlays\.spec\.ts/
const PARITY = /parity\.spec\.ts/
const DEV = /dev\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${PORTS.static}/`,
    trace: 'on-first-retry',
  },

  projects: [
    // `channel: 'chromium'` — полный сборочный chromium вместо headless-shell:
    // shell не отдаёт кадры `Page.startScreencast`, а гейт первого кадра на них
    // и держится. Без канала тест «проходит» на нуле кадров.
    {
      name: 'chromium-dark',
      testMatch: FIRST_PAINT,
      use: { ...devices['Desktop Chrome'], channel: 'chromium', colorScheme: 'dark' },
    },
    {
      name: 'chromium-light',
      testMatch: FIRST_PAINT,
      use: { ...devices['Desktop Chrome'], channel: 'chromium', colorScheme: 'light' },
    },
    {
      name: 'overlays',
      testMatch: OVERLAYS,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'parity',
      testMatch: PARITY,
      use: { ...devices['Desktop Chrome'], channel: 'chromium', colorScheme: 'light' },
    },
    {
      name: 'dev',
      testMatch: DEV,
      use: { ...devices['Desktop Chrome'], channel: 'chromium', colorScheme: 'light' },
    },
  ],

  /*
   * `astro preview` здесь не годится: в Astro 7 он демонизируется и возвращает
   * управление сразу — Playwright видит упавший процесс, а демон остаётся жить
   * и отдавать **ту сборку, с которой был запущен**. Подробности — в
   * `e2e/serve.mjs`; у `astro dev` та же беда, и её держит `e2e/dev-server.mjs`.
   *
   * `reuseExistingServer: false` намеренно: переиспользование чужого сервера и
   * есть тот механизм, которым гейт молча начинал проверять не ту сборку.
   * Занятый порт теперь роняет прогон громко.
   */
  webServer: [
    {
      command: `npx astro build && node ../../e2e/serve.mjs ${PORTS.static} dist`,
      cwd: './examples/static',
      url: `http://localhost:${PORTS.static}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx astro build && node dist/server/entry.mjs',
      cwd: './examples/ssr',
      env: { HOST: 'localhost', PORT: String(PORTS.ssr) },
      url: `http://localhost:${PORTS.ssr}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx astro build && node dist/server/entry.mjs',
      cwd: './examples/hybrid',
      env: { HOST: 'localhost', PORT: String(PORTS.hybrid) },
      url: `http://localhost:${PORTS.hybrid}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node e2e/dev-server.mjs ${PORTS.dev} examples/static`,
      url: `http://localhost:${PORTS.dev}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
