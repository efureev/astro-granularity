import { describe, expect, it } from 'vitest'
import granularity from '../index'

/**
 * Регистрация middleware, кладущего строки в HTML.
 *
 * Раньше здесь жили отказы: состояние страницы было модульной переменной, и
 * фича выключалась везде, где страницы могли рендериться одновременно — под
 * адаптером (`output: 'server'`) и при `build.concurrency > 1`. Платой была
 * английская разметка на локализованных маршрутах и отсутствие снимка строк.
 *
 * Состояние переехало в `AsyncLocalStorage` (`src/ssr-store.ts`), у каждого
 * запроса свой контекст — отказывать стало не от чего. Тесты держат именно это:
 * middleware регистрируется при любой конфигурации вывода, и выключить его
 * можно только руками.
 */
type Registered = { middleware: boolean, warnings: string[] }

async function setup(config: Record<string, unknown>, options = {}): Promise<Registered> {
  const result: Registered = { middleware: false, warnings: [] }
  const integration = granularity(options)

  await integration.hooks['astro:config:setup']?.({
    addMiddleware: () => { result.middleware = true },
    config: { build: {}, integrations: [], root: process.cwd(), ...config },
    updateConfig: () => {},
    injectScript: () => {},
    logger: { warn: (m: string) => result.warnings.push(m), error: () => {} },
  } as never)

  return result
}

describe('строки в HTML: когда middleware регистрируется', () => {
  it('на статической сборке', async () => {
    const { middleware } = await setup({ output: 'static' })

    expect(middleware).toBe(true)
  })

  it('без явного `output` — статика это умолчание Astro', async () => {
    const { middleware } = await setup({})

    expect(middleware).toBe(true)
  })

  it('при `output: "server"` — параллельные запросы контексту не мешают', async () => {
    const { middleware, warnings } = await setup({ output: 'server' })

    expect(middleware).toBe(true)
    // И молча: отказывать не от чего, предупреждать не о чем.
    expect(warnings).toEqual([])
  })

  it('при `build.concurrency > 1` — параллельная генерация тоже', async () => {
    const { middleware, warnings } = await setup({ output: 'static', build: { concurrency: 4 } })

    expect(middleware).toBe(true)
    expect(warnings).toEqual([])
  })

  it('при `ssrStrings: false` не регистрируется — отказ объявлен потребителем', async () => {
    const { middleware, warnings } = await setup(
      { output: 'server' },
      { i18n: { ssrStrings: false as const } },
    )

    expect(middleware).toBe(false)
    expect(warnings).toEqual([])
  })
})
