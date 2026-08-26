import { describe, expect, it } from 'vitest'
import { assertPackageSpecifier, buildI18nModuleSource } from '../i18n'

const base = { packages: [], locales: [], defaultLocale: 'en', ssrStrings: 'used' as const }

/** Пакеты экосистемы, на которых проверяется форма порождённого модуля. */
const ECOSYSTEM = [
  '@feugene/granularity-chrono',
  '@feugene/granularity-charts',
  '@feugene/granularity-dashboard',
  '@feugene/granularity-editor',
  '@feugene/granularity-media',
  '@feugene/granularity-forms-schema',
]

describe('buildI18nModuleSource', () => {
  it('эмитит locales — их читает middleware, когда `currentLocale` пуст', () => {
    const source = buildI18nModuleSource({ ...base, locales: ['en', 'ru'] })

    expect(source).toContain('export const locales = ["en","ru"]')
  })

  it('эмитит ssrStrings — режим читают и точка входа, и middleware', () => {
    expect(buildI18nModuleSource(base)).toContain('export const ssrStrings = "used"')
    expect(buildI18nModuleSource({ ...base, ssrStrings: false })).toContain('export const ssrStrings = false')
  })

  it('ядро подключается всегда, даже когда packages пуст', () => {
    expect(buildI18nModuleSource(base)).toContain('"@feugene/granularity/i18n/all"')
  })

  it('без явных локалей берёт агрегат /i18n/all', () => {
    expect(buildI18nModuleSource(base)).toContain('/i18n/all"')
  })

  it('с явными локалями импортирует именованные — иначе в бандл уедет и `es`', () => {
    const source = buildI18nModuleSource({ ...base, locales: ['en', 'ru'] })
    expect(source).not.toContain('/i18n/all')
    expect(source).toContain('en as en0')
    expect(source).toContain('ru as ru0')
    // По имени привязки, а не по подстроке: `es` встречается в самом слове
    // `locales`, и проверка на подстроку зеленела бы мимо предмета.
    expect(source).not.toMatch(/\bes as es\d/)
  })

  it('спутники подключаются рядом с ядром', () => {
    const source = buildI18nModuleSource({ ...base, packages: ['@feugene/granularity-chrono'] })
    expect(source).toContain('"@feugene/granularity-chrono/i18n/all"')
    expect(source).toContain('"@feugene/granularity/i18n/all"')
  })

  it('ядро в packages не задваивается', () => {
    const source = buildI18nModuleSource({ ...base, packages: ['@feugene/granularity'] })
    expect(source.match(/@feugene\/granularity\/i18n/g)).toHaveLength(1)
  })

  it('блоки выводятся из лоадеров, а не импортируются константами', () => {
    // Имя блока лежит внутри коллекции вторым уровнем ключа, поэтому реестр
    // «пакет → имя константы» не нужен. Констант в исходнике быть не должно.
    const source = buildI18nModuleSource({ ...base, packages: ECOSYSTEM, locales: ['en'] })
    expect(source).toContain('export const blocks = deriveI18nBlocks(loaders)')
    expect(source).not.toMatch(/_I18N_BLOCK/)
  })

  it('лоадеры уплощаются `.flat()`, а не спредом', () => {
    // `/i18n/all` отдаёт массив коллекций, именованный экспорт — одну коллекцию.
    // Спред объекта бросил бы `TypeError` в рантайме острова.
    expect(buildI18nModuleSource(base)).toMatch(/export const loaders = \[.*\]\.flat\(\)/)
  })

  it('экспортирует defaultLocale для случая, когда `<html lang>` пуст', () => {
    expect(buildI18nModuleSource({ ...base, defaultLocale: 'ru' })).toContain('export const defaultLocale = "ru"')
  })

  it('отвергает локаль, которая не является именем импорта', () => {
    // Локаль подставляется в исходник модуля, поэтому это не педантизм:
    // без проверки строка стала бы исполняемым кодом.
    expect(() => buildI18nModuleSource({ ...base, locales: ['en; globalThis.pwned = 1'] })).toThrow(/не годится/)
    expect(() => buildI18nModuleSource({ ...base, locales: ['../evil'] })).toThrow(/не годится/)
    expect(() => buildI18nModuleSource({ ...base, defaultLocale: 'en"; x' })).toThrow(/не годится/)
  })

  it('отвергает имя пакета, которым можно внести код', () => {
    // Спецификатор так же уезжает в исходник. Проверка обязана быть явной:
    // молчаливое доверие имени превращает опцию в точку исполнения.
    for (const evil of [
      'x\'; globalThis.pwned = 1//',
      '../evil',
      '/abs/path',
      'http://example.com/x',
      '@scope/pkg/sub',
      'pkg x',
      'a'.repeat(215),
    ])
      expect(() => buildI18nModuleSource({ ...base, packages: [evil] }), evil).toThrow(/не годится как имя пакета/)
  })

  it('пропускает законные имена — и голые, и со скоупом', () => {
    for (const good of ['pkg', 'my-pkg', 'my.pkg', '@scope/pkg', '@feugene/granularity-chrono'])
      expect(() => assertPackageSpecifier(good), good).not.toThrow()
  })

  it('спецификаторы эмитятся литералом строки, а не в кавычках вручную', () => {
    // `JSON.stringify` — второй слой защиты: даже пробей кто-то валидацию,
    // подстановка останется данными. Двойные кавычки в выводе это и пинят.
    expect(buildI18nModuleSource({ ...base, locales: ['en'] })).toContain('from "@feugene/granularity/i18n"')
  })

  it('порождённый исходник — синтаксически валидный модуль', async () => {
    // Настоящий разбор, а не самодельная эвристика: генератор клеит строки,
    // и сломанный импорт заметит только парсер.
    const { transform } = await import('esbuild')
    for (const locales of [[], ['en'], ['en', 'ru']]) {
      const source = buildI18nModuleSource({ ...base, locales, packages: ECOSYSTEM })
      await expect(transform(source, { loader: 'js', format: 'esm' })).resolves.toBeTruthy()
    }
  })

  it('на каждый пакет приходится по лоадеру', () => {
    const source = buildI18nModuleSource({ ...base, packages: ECOSYSTEM, locales: ['en'] })
    const loaders = source.match(/export const loaders = \[(.*)\]\.flat\(\)/)![1]!.split(', ')
    // Плюс ядро, которое подключается всегда.
    expect(loaders).toHaveLength(ECOSYSTEM.length + 1)
  })
})
