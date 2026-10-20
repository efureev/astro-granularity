import { describe, expect, it } from 'vitest'
import { GRANUM_PLUGIN_NAME, VUE_INTEGRATION_NAME } from '../env-check'
import granularity from '../index'

/**
 * Проверка окружения читает `config.vite.plugins`, а он полон только после
 * того, как отработали все интеграции. Поэтому она живёт в `astro:config:done`,
 * и это не деталь реализации: в `astro:config:setup` она ругалась бы на
 * исправный проект, где granum добавляет интеграция, идущая следом.
 */
function hooks(options = {}): NonNullable<ReturnType<typeof granularity>['hooks']> {
  return granularity(options).hooks
}

const SETUP_ARGS = {
  addMiddleware: () => {},
  config: { build: {}, integrations: [], root: process.cwd() },
  updateConfig: () => {},
  injectScript: () => {},
  logger: { warn: () => {}, error: () => {} },
}

function doneArgs(integrationNames: string[], pluginNames: string[]): unknown {
  return {
    config: {
      integrations: integrationNames.map(name => ({ name })),
      vite: { plugins: pluginNames.map(name => ({ name })) },
    },
    logger: { warn: () => {}, error: () => {} },
  }
}

describe('где живёт проверка окружения', () => {
  it('`astro:config:setup` не проверяет ничего: список плагинов там ещё неполон', async () => {
    // Окружение заведомо сломано — ни vue, ни granum, — и тем не менее молчит.
    await expect(hooks()['astro:config:setup']?.(SETUP_ARGS as never)).resolves.not.toThrow()
  })

  it('`astro:config:done` роняет сборку, когда плагина granum нет', async () => {
    const done = hooks()['astro:config:done']
    await expect(done?.(doneArgs([VUE_INTEGRATION_NAME], ['vite:vue']) as never))
      .rejects.toThrow('нет плагина granum')
  })

  it('`astro:config:done` молчит на здоровом конфиге', async () => {
    const done = hooks()['astro:config:done']
    await expect(done?.(doneArgs([VUE_INTEGRATION_NAME], [GRANUM_PLUGIN_NAME]) as never))
      .resolves.not.toThrow()
  })

  it('при `strict: false` ошибка не роняет сборку', async () => {
    const done = hooks({ strict: false })['astro:config:done']
    await expect(done?.(doneArgs([], []) as never)).resolves.not.toThrow()
  })
})

describe('скрипт режима в `<head>`', () => {
  type Mode = { name: string, colorScheme: 'light' | 'dark', value: string }
  const SLATE_MODES: Mode[] = [
    { name: 'light', colorScheme: 'light', value: 'slate-light' },
    { name: 'dark', colorScheme: 'dark', value: 'slate-dark' },
  ]
  const withModes = (modes: Mode[]) => ({
    themes: [{ id: 'slate', title: 'Slate', modes, defaultMode: modes[0]?.name ?? 'light' }],
    defaultTheme: 'slate',
    activation: { attribute: 'data-theme' },
  })
  const SLATE = withModes(SLATE_MODES)

  function granumPlugin(manifest: unknown, roots: string[] = []) {
    return { name: GRANUM_PLUGIN_NAME, api: { themeManifest: async (root?: string) => (roots.push(root ?? ''), manifest) } }
  }

  async function setup(plugins: unknown[], options = {}) {
    const injected: Array<[string, string]> = []
    const warnings: string[] = []
    const integration = hooks(options)
    await integration['astro:config:setup']?.({
      ...SETUP_ARGS,
      config: { ...SETUP_ARGS.config, root: '/site', vite: { plugins } },
      injectScript: (stage: string, content: string) => injected.push([stage, content]),
      logger: { warn: (m: string) => warnings.push(m), error: () => {} },
    } as never)
    return { integration, injected, warnings }
  }

  it('строится по манифесту плагина granum с корнем проекта и встаёт `head-inline`', async () => {
    const roots: string[] = []
    const { injected } = await setup([granumPlugin(SLATE, roots)])
    expect(roots).toEqual(['/site'])
    expect(injected).toHaveLength(1)
    expect(injected[0]![0]).toBe('head-inline')
    expect(injected[0]![1]).toContain('slate-dark')
  })

  it('`injectThemeScript: false` и основная тема без режимов — скрипта нет', async () => {
    expect((await setup([granumPlugin(SLATE)], { injectThemeScript: false })).injected).toEqual([])
    expect((await setup([granumPlugin(withModes([]))])).injected).toEqual([])
  })

  it('сверх бюджета — предупреждение, а не падение', async () => {
    const modes = Array.from({ length: 40 }, (_, i): Mode => ({ name: `m${i}`, colorScheme: 'dark', value: `slate-m${i}` }))
    const { injected, warnings } = await setup([granumPlugin(withModes(modes))])
    expect(injected).toHaveLength(1)
    expect(warnings.join('\n')).toMatch(/при бюджете/)
  })

  it('granum без `api.themeManifest` роняет сборку в `astro:config:done`', async () => {
    const { integration } = await setup([{ name: GRANUM_PLUGIN_NAME }])
    await expect(integration['astro:config:done']?.(doneArgs([VUE_INTEGRATION_NAME], [GRANUM_PLUGIN_NAME]) as never))
      .rejects.toThrow('api.themeManifest')
  })

  it('плагин, добавленный позже интеграции, — предупреждение о пропущенном скрипте', async () => {
    const { integration } = await setup([])
    const warnings: string[] = []
    const args = doneArgs([VUE_INTEGRATION_NAME], [GRANUM_PLUGIN_NAME]) as { logger: { warn: (m: string) => void } }
    args.logger.warn = m => void warnings.push(m)
    await integration['astro:config:done']?.(args as never)
    expect(warnings.join('\n')).toMatch(/скрипт режима не вставлен/)
  })
})
