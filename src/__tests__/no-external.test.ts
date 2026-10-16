import { describe, expect, it } from 'vitest'
import granularity from '../index'

/**
 * Пакеты, которые обязаны попасть в серверный бандл, — в обоих окружениях.
 *
 * `prerender` — статическая сборка, `ssr` — dev-сервер и сборка под адаптером.
 * Серверные входы интеграции и `@astrojs/vue` импортируют `virtual:`-модули, а
 * их разрешает только бандлер: внешний модуль Node грузит сам и падает на
 * протоколе `virtual:`. Гейт пакета dev не поднимает, поэтому границу держит
 * этот тест.
 */
type Environments = Record<string, { resolve?: { noExternal?: unknown[] } }>

async function collectEnvironments(): Promise<Environments> {
  const environments: Environments = {}
  const integration = granularity({ strict: false })

  await integration.hooks['astro:config:setup']?.({
    addMiddleware: () => {},
    config: { build: {}, integrations: [], root: process.cwd() },
    updateConfig: (patch: { vite?: { environments?: Environments } }) => {
      Object.assign(environments, patch.vite?.environments ?? {})
    },
    injectScript: () => {},
    logger: { warn: () => {}, error: () => {} },
  } as never)

  return environments
}

const matches = (list: unknown[] | undefined, specifier: string): boolean =>
  (list ?? []).some(entry => entry instanceof RegExp ? entry.test(specifier) : entry === specifier)

describe('noExternal: какие окружения получают список', () => {
  it.each(['ssr', 'prerender'])('%s — `@astrojs/vue` и сама интеграция', async (name) => {
    const environments = await collectEnvironments()
    const list = environments[name]?.resolve?.noExternal

    expect(list, `окружение ${name} без noExternal`).toBeDefined()
    expect(matches(list, '@astrojs/vue')).toBe(true)
    expect(matches(list, '@feugene/astro-granularity')).toBe(true)
  })

  /*
   * Пакеты дизайн-системы Node грузит как есть: в их `dist` нет ни `.css`, ни
   * granum. Встраивать их значит удлинять каждую серверную сборку ни за что —
   * e2e трёх стендов и `astro dev` проходят и без этого.
   */
  it('семейство `@feugene/granularity*` остаётся внешним', async () => {
    const environments = await collectEnvironments()

    expect(matches(environments.ssr?.resolve?.noExternal, '@feugene/granularity/components/GrIcon')).toBe(false)
    expect(matches(environments.prerender?.resolve?.noExternal, '@feugene/granularity-charts')).toBe(false)
  })

  it('`client` не трогается — там внешних модулей не бывает', async () => {
    const environments = await collectEnvironments()

    expect(environments.client).toBeUndefined()
  })
})
