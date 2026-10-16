import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import granularity from '../index'

const resolverOptions: unknown[] = []

vi.mock('@feugene/unplugin-granularity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@feugene/unplugin-granularity')>()
  return {
    ...actual,
    GranularityResolver: (options: Parameters<typeof actual.GranularityResolver>[0]) => {
      resolverOptions.push(options)
      return actual.GranularityResolver(options)
    },
  }
})

/**
 * Резолвер ищет пакеты экосистемы в `package.json` от `root` и по умолчанию
 * берёт `process.cwd()`. Astro собирает проект и из чужого каталога
 * (`astro build --root <проект>`), поэтому корень обязан приехать из конфига.
 */
describe('резолвер авто-импорта получает корень проекта', () => {
  it('URL из `config.root` превращается в путь', async () => {
    resolverOptions.length = 0
    const root = '/srv/sites/shop'

    await granularity({ strict: false }).hooks['astro:config:setup']?.({
      addMiddleware: () => {},
      config: { build: {}, integrations: [], root: pathToFileURL(`${root}/`) },
      updateConfig: () => {},
      injectScript: () => {},
      logger: { warn: () => {}, error: () => {} },
    } as never)

    expect(resolverOptions).toEqual([{ root: `${root}/` }])
  })
})
