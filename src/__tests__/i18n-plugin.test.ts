import { describe, expect, it } from 'vitest'
import { VIRTUAL_I18N_ID } from '../i18n'
import { createVirtualI18nPlugin } from '../i18n-plugin'

const input = { packages: [], locales: ['en'], defaultLocale: 'en', ssrStrings: 'used' as const }
const RESOLVED = `\0${VIRTUAL_I18N_ID}`

describe('createVirtualI18nPlugin', () => {
  it('резолвит только свой id', () => {
    const plugin = createVirtualI18nPlugin(input)

    expect(plugin.resolveId(VIRTUAL_I18N_ID)).toBe(RESOLVED)
    expect(plugin.resolveId('virtual:granular-themes')).toBeNull()
    expect(plugin.resolveId('vue')).toBeNull()
  })

  it('отдаёт исходник только по разрешённому id', () => {
    // `\0`-префикс закрывает модуль от разрешения по файловой системе, поэтому
    // сырой id грузиться не должен.
    const plugin = createVirtualI18nPlugin(input)

    expect(plugin.load(RESOLVED)).toContain('export const loaders')
    expect(plugin.load(VIRTUAL_I18N_ID)).toBeNull()
    expect(plugin.load('\0virtual:other')).toBeNull()
  })

  it('при `i18n: false` резолвит, но объясняет отказ', () => {
    // Резолвить обязан: иначе забытый `appEntrypoint` даёт сырое вайтовое
    // «Failed to resolve import», и причину ищут в приложении.
    const plugin = createVirtualI18nPlugin(false)

    expect(plugin.resolveId(VIRTUAL_I18N_ID)).toBe(RESOLVED)
    expect(() => plugin.load(RESOLVED)).toThrow(/выключен опцией `i18n: false`/)
    expect(() => plugin.load(RESOLVED)).toThrow(/appEntrypoint/)
  })

  it('исходник считается один раз, а не на каждый load', () => {
    const plugin = createVirtualI18nPlugin(input)

    expect(plugin.load(RESOLVED)).toBe(plugin.load(RESOLVED))
  })

  it('кривой состав роняет создание плагина, а не первый импорт', () => {
    // Ошибка на этапе конфигурации называет опцию; ошибка на `load` пришла бы
    // из середины сборки и указывала бы на виртуальный id.
    expect(() => createVirtualI18nPlugin({ ...input, packages: ['../evil'] }))
      .toThrow(/не годится как имя пакета/)
  })
})
