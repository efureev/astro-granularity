import { describe, expect, it } from 'vitest'
import granularity from '../index'

/**
 * Пакеты, которые обязаны попасть в серверный бандл, — в обоих окружениях.
 *
 * `prerender` — статическая сборка, `ssr` — dev-сервер и сборка под адаптером.
 * Одного `prerender` не хватало: `astro dev` шёл мимо списка, и первый же
 * компонент с `import '../styles.css'` в чанке ронял страницу. Гейт пакета
 * dev не поднимает, поэтому границу держит этот тест.
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
  it.each(['ssr', 'prerender'])('%s — семейство ядра, `@astrojs/vue` и сама интеграция', async (name) => {
    const environments = await collectEnvironments()
    const list = environments[name]?.resolve?.noExternal

    expect(list, `окружение ${name} без noExternal`).toBeDefined()
    expect(matches(list, '@feugene/granularity/components/GrIcon')).toBe(true)
    expect(matches(list, '@feugene/granularity-charts')).toBe(true)
    expect(matches(list, '@astrojs/vue')).toBe(true)
    expect(matches(list, '@feugene/astro-granularity')).toBe(true)
  })

  it('`client` не трогается — там внешних модулей не бывает', async () => {
    const environments = await collectEnvironments()

    expect(environments.client).toBeUndefined()
  })
})
