import { describe, expect, it } from 'vitest'
import granularity from '../index'

/**
 * Регистрация middleware, кладущего строки в HTML.
 *
 * Состояние страницы — модульная переменная (`src/ssr.ts`), поэтому фича верна
 * только там, где страницы обрабатываются по одной. Где это не так, интеграция
 * обязана отказать вслух, а не отдать одному запросу язык другого.
 */
type Registered = { middleware: boolean, warnings: string[] }

async function setup(config: Record<string, unknown>, options = {}): Promise<Registered> {
  const result: Registered = { middleware: false, warnings: [] }
  // `strict: false`: проверка окружения ищет `uno.config` рядом с корнем и в
  // тестовом прогоне его не находит. Предмет проверки — не она.
  const integration = granularity({ strict: false, ...options })

  await integration.hooks['astro:config:setup']?.({
    addMiddleware: () => { result.middleware = true },
    config: { build: {}, integrations: [], root: process.cwd(), ...config },
    updateConfig: () => {},
    injectScript: () => {},
    logger: { warn: (m: string) => result.warnings.push(m), error: () => {} },
  } as never)

  return result
}

describe('строки в HTML: где middleware не регистрируется', () => {
  it('на статической сборке регистрируется', async () => {
    const { middleware } = await setup({ output: 'static' })

    expect(middleware).toBe(true)
  })

  it('без явного `output` тоже регистрируется — статика это умолчание Astro', async () => {
    const { middleware } = await setup({})

    expect(middleware).toBe(true)
  })

  it('при `output: "server"` отказывает: запросы идут параллельно в одном процессе', async () => {
    const { middleware, warnings } = await setup({ output: 'server' })

    expect(middleware).toBe(false)
    // Сообщение обязано содержать готовую починку, а не только диагноз.
    expect(warnings.join('\n')).toContain('ssrStrings: false')
  })

  it('при `build.concurrency > 1` отказывает: страницы генерируются параллельно', async () => {
    const { middleware, warnings } = await setup({ output: 'static', build: { concurrency: 4 } })

    expect(middleware).toBe(false)
    expect(warnings.join('\n')).toContain('concurrency')
  })

  it('при `ssrStrings: false` молчит — отказ объявлен потребителем', async () => {
    const { middleware, warnings } = await setup(
      { output: 'server' },
      { i18n: { ssrStrings: false as const } },
    )

    expect(middleware).toBe(false)
    expect(warnings.join('\n')).not.toContain('строки в HTML')
  })
})
