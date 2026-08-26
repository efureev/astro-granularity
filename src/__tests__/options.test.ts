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
      i18n: { packages: [], locales: [], ssrStrings: 'used' },
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
    expect(resolved.i18n).toEqual({ packages: [], locales: ['en'], ssrStrings: 'used' })
  })

  it('`i18n: false` выключает модуль целиком', () => {
    expect(resolveOptions({ i18n: false }).i18n).toBe(false)
  })

  it('ssrStrings по умолчанию `used`: строки едут в HTML, но клиент долечивает фоном', () => {
    expect(resolveOptions({}).i18n).toMatchObject({ ssrStrings: 'used' })
  })

  it('ssrStrings принимает `full` и `false`', () => {
    expect(resolveOptions({ i18n: { ssrStrings: 'full' } }).i18n).toMatchObject({ ssrStrings: 'full' })
    expect(resolveOptions({ i18n: { ssrStrings: false } }).i18n).toMatchObject({ ssrStrings: false })
  })

  it('чужое значение ssrStrings роняет на границе, а не в середине сборки', () => {
    // @ts-expect-error проверяется поведение на входе из JS без типов
    expect(() => resolveOptions({ i18n: { ssrStrings: 'all' } }))
      .toThrow(/\[astro-granularity\] i18n\.ssrStrings/)
    // @ts-expect-error то же самое для `true`: булев флаг здесь не режим
    expect(() => resolveOptions({ i18n: { ssrStrings: true } })).toThrow(/ssrStrings/)
  })

  it('без опции i18n модуль включён с пустым составом', () => {
    expect(resolveOptions({}).i18n).toEqual({ packages: [], locales: [], ssrStrings: 'used' })
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
