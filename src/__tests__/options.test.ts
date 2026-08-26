import { describe, expect, it } from 'vitest'
import { DEFAULT_STORAGE_KEY, resolveOptions } from '../options'

describe('resolveOptions', () => {
  it('без аргументов даёт рабочие умолчания', () => {
    expect(resolveOptions()).toEqual({
      defaultTheme: 'system',
      themeStorageKey: DEFAULT_STORAGE_KEY,
      injectThemeScript: true,
      injectStyleBundle: false,
      resolver: true,
      i18n: { packages: [], locales: [] },
      strict: true,
    })
  })

  it('бандл стилей выключен по умолчанию: при `presetGranularNode` он удвоил бы CSS', () => {
    expect(resolveOptions().injectStyleBundle).toBe(false)
  })

  it('каждая автоматическая вещь выключается флагом', () => {
    const off = resolveOptions({ injectThemeScript: false, resolver: false, strict: false })
    expect(off.injectThemeScript).toBe(false)
    expect(off.resolver).toBe(false)
    expect(off.strict).toBe(false)
  })

  it('копирует массивы, а не держит ссылку на чужой', () => {
    const locales = ['en']
    const resolved = resolveOptions({ i18n: { locales } })
    locales.push('ru')
    expect(resolved.i18n).toEqual({ packages: [], locales: ['en'] })
  })

  it('`i18n: false` выключает модуль целиком', () => {
    expect(resolveOptions({ i18n: false }).i18n).toBe(false)
  })

  it('без опции i18n модуль включён с пустым составом', () => {
    expect(resolveOptions({}).i18n).toEqual({ packages: [], locales: [] })
  })

  it('отвергает i18n не-объектом', () => {
    expect(() => resolveOptions({ i18n: [] as never })).toThrow(/ожидался объект/)
    expect(() => resolveOptions({ i18n: 'all' as never })).toThrow(/ожидался объект/)
  })

  it('отвергает неизвестную тему', () => {
    // @ts-expect-error проверяем рантайм-валидацию
    expect(() => resolveOptions({ defaultTheme: 'sepia' })).toThrow(/defaultTheme/)
  })

  it('отвергает пустой ключ хранилища', () => {
    expect(() => resolveOptions({ themeStorageKey: '' })).toThrow(/themeStorageKey/)
  })
})
