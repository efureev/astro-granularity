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
