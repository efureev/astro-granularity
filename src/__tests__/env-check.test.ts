import { describe, expect, it } from 'vitest'
import {
  checkEnvironment,
  collectPresetNames,
  GRANULAR_PRESET_NAME,
  VUE_INTEGRATION_NAME,
} from '../env-check'

const OK = { integrationNames: [VUE_INTEGRATION_NAME], presetNames: [GRANULAR_PRESET_NAME] }

describe('collectPresetNames', () => {
  it('находит пресет на верхнем уровне', () => {
    expect(collectPresetNames([{ name: 'a' }, { name: 'b' }])).toEqual(['a', 'b'])
  })

  it('находит вложенный пресет — составные пресеты потребителя дали бы ложную тревогу', () => {
    const nested = [{ name: 'wrapper', presets: [{ name: GRANULAR_PRESET_NAME }] }]
    expect(collectPresetNames(nested)).toContain(GRANULAR_PRESET_NAME)
  })

  it('переживает циклическую ссылку', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.presets = [a]
    expect(() => collectPresetNames([a])).not.toThrow()
    expect(collectPresetNames([a])).toEqual(['a'])
  })

  it('не спотыкается о не-массив и о null внутри', () => {
    expect(collectPresetNames(undefined)).toEqual([])
    expect(collectPresetNames([null, 42, { name: 'a' }])).toEqual(['a'])
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

  it('без granular-пресета — ошибка: компоненты приедут бесцветными', () => {
    const problems = checkEnvironment({ ...OK, presetNames: ['presetMini'] })
    expect(problems[0]!.code).toBe('no-uno-preset')
    expect(problems[0]!.level).toBe('error')
  })

  it('нечитаемый конфиг — предупреждение, а не ошибка: «не проверили» ≠ «нет»', () => {
    const problems = checkEnvironment({ ...OK, presetNames: null })
    expect(problems[0]!.code).toBe('uno-config-unreadable')
    expect(problems[0]!.level).toBe('warn')
  })

  it('сообщение называет починку, а не только диагноз', () => {
    const [problem] = checkEnvironment({ ...OK, presetNames: [] })
    expect(problem!.message).toContain('presetGranularNode')
    expect(problem!.message).toContain('uno.config.ts')
  })
})
