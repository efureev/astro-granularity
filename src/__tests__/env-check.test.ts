import { windEngine } from '@feugene/granum-engine-wind'
import { granum } from '@feugene/granum/vite'
import { describe, expect, it } from 'vitest'
import {
  checkEnvironment,
  collectPluginNames,
  GRANUM_PLUGIN_NAME,
  VUE_INTEGRATION_NAME,
} from '../env-check'

const OK = { integrationNames: [VUE_INTEGRATION_NAME], pluginNames: [GRANUM_PLUGIN_NAME] }

describe('collectPluginNames', () => {
  it('находит плагин на верхнем уровне', async () => {
    await expect(collectPluginNames([{ name: 'a' }, { name: 'b' }])).resolves.toEqual(['a', 'b'])
  })

  it('разворачивает вложенные массивы — пресет плагинов потребителя дал бы ложную тревогу', async () => {
    const nested = [{ name: 'vue' }, [{ name: 'wrapper' }, [{ name: GRANUM_PLUGIN_NAME }]]]
    await expect(collectPluginNames(nested)).resolves.toContain(GRANUM_PLUGIN_NAME)
  })

  it('не спотыкается о не-массив и о выключенные плагины внутри', async () => {
    await expect(collectPluginNames(undefined)).resolves.toEqual([])
    // `false` и `null` на месте плагина — штатная форма `PluginOption`.
    await expect(collectPluginNames([null, false, 42, { name: 'a' }])).resolves.toEqual(['a'])
  })

  it('дожидается промисов: `PluginOption` допускает и сам список, и его элементы', async () => {
    const withPromises = Promise.resolve([Promise.resolve({ name: GRANUM_PLUGIN_NAME }), { name: 'vue' }])
    await expect(collectPluginNames(withPromises)).resolves.toEqual([GRANUM_PLUGIN_NAME, 'vue'])
  })
})

describe('checkEnvironment', () => {
  it('на здоровом окружении молчит', () => {
    expect(checkEnvironment(OK)).toEqual([])
  })

  it('без @astrojs/vue — ошибка: острова не отрисуются', () => {
    const problems = checkEnvironment({ ...OK, integrationNames: [] })
    expect(problems).toHaveLength(1)
    expect(problems[0]!.code).toBe('no-vue-integration')
    expect(problems[0]!.level).toBe('error')
  })

  it('без плагина granum — ошибка: компоненты приедут голыми', () => {
    const problems = checkEnvironment({ ...OK, pluginNames: ['vite:vue'] })
    expect(problems[0]!.code).toBe('no-granum-plugin')
    expect(problems[0]!.level).toBe('error')
  })

  it('два плагина granum — ошибка: виртуальные модули отдаёт тот, что успел первым', () => {
    const problems = checkEnvironment({ ...OK, pluginNames: [GRANUM_PLUGIN_NAME, 'vite:vue', GRANUM_PLUGIN_NAME] })
    expect(problems[0]!.code).toBe('duplicate-granum-plugin')
    expect(problems[0]!.level).toBe('error')
  })

  it('нечитаемый список — предупреждение, а не ошибка: «не проверили» ≠ «нет»', () => {
    const problems = checkEnvironment({ ...OK, pluginNames: null })
    expect(problems[0]!.code).toBe('granum-plugins-unreadable')
    expect(problems[0]!.level).toBe('warn')
  })

  it('сообщение называет починку целиком, а не только диагноз', () => {
    const [problem] = checkEnvironment({ ...OK, pluginNames: [] })
    expect(problem!.message).toContain('vite: { plugins: [granum(granumConfig)] }')
    expect(problem!.message).toContain("import 'virtual:granum.css'")
  })
})

/*
 * Имя плагина захардкожено строкой, чтобы не тащить granum в рантайм пакета:
 * он опциональный peer, и проект без компонентов обязан ставиться без него.
 * Цена — константа может разойтись с granum молча, поэтому сверяется с
 * настоящим плагином.
 */
describe('имя плагина granum', () => {
  it('совпадает с тем, под которым granum регистрируется в Vite', () => {
    const plugin = granum({ engine: windEngine(), providers: ['@feugene/granularity'] })
    expect(plugin.name).toBe(GRANUM_PLUGIN_NAME)
  })
})
