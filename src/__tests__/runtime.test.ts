import { describe, expect, it, vi } from 'vitest'
import { deriveI18nBlocks, provideGranularityI18n, readPageLocale } from '../runtime'

const loader = () => Promise.resolve({})

describe('deriveI18nBlocks', () => {
  it('берёт имя блока из второго уровня ключа', () => {
    expect(deriveI18nBlocks([{ en: { gr: loader } }])).toEqual(['gr'])
  })

  it('склеивает блоки нескольких пакетов', () => {
    const blocks = deriveI18nBlocks([
      { en: { gr: loader } },
      { en: { grChrono: loader } },
      { en: { grForms: loader } },
    ])
    expect(blocks).toEqual(['gr', 'grChrono', 'grForms'])
  })

  it('не повторяет блок, объявленный в нескольких локалях', () => {
    // Один пакет отдаёт по коллекции на локаль, и блок в них один и тот же.
    expect(deriveI18nBlocks([{ en: { gr: loader } }, { ru: { gr: loader } }])).toEqual(['gr'])
  })

  it('сохраняет порядок объявления', () => {
    // `registerBlocks` ведёт счётчик ссылок; стабильный порядок делает
    // поведение воспроизводимым между сборками.
    expect(deriveI18nBlocks([{ en: { b: loader, a: loader } }])).toEqual(['b', 'a'])
  })

  it('терпит коллекцию с несколькими блоками', () => {
    expect(deriveI18nBlocks([{ en: { gr: loader, 'components.GrButton': loader } }]))
      .toEqual(['gr', 'components.GrButton'])
  })

  it('на пустом входе отдаёт пустой список, а не бросает', () => {
    expect(deriveI18nBlocks([])).toEqual([])
    expect(deriveI18nBlocks([{}])).toEqual([])
  })
})

describe('readPageLocale', () => {
  it('берёт `<html lang>`', () => {
    vi.stubGlobal('document', { documentElement: { lang: 'ru' } })
    expect(readPageLocale('en')).toBe('ru')
    vi.unstubAllGlobals()
  })

  it('обрезает пробелы', () => {
    vi.stubGlobal('document', { documentElement: { lang: '  ru  ' } })
    expect(readPageLocale('en')).toBe('ru')
    vi.unstubAllGlobals()
  })

  it('на пустом `lang` откатывается к defaultLocale', () => {
    vi.stubGlobal('document', { documentElement: { lang: '   ' } })
    expect(readPageLocale('en')).toBe('en')
    vi.unstubAllGlobals()
  })

  it('без `document` — тоже defaultLocale', () => {
    // Модуль исполняется и на пререндере: обращение к `document` там уронило бы
    // сборку страницы, а не только строки.
    expect(readPageLocale('en')).toBe('en')
  })
})

describe('provideGranularityI18n', () => {
  const adapter = { t: (key: string) => key }

  function fakeApp() {
    const provided: Array<[symbol, unknown]> = []
    return { provided, app: { provide: (k: symbol, v: unknown) => void provided.push([k, v]) } }
  }

  it('по умолчанию кладёт адаптер под оба ключа', () => {
    // Пакеты, не перешедшие на композабл ядра, ищут инстанс только по
    // fint-ключу. Провайд под одним ключом ядра даёт у них молчаливый
    // английский fallback вместо перевода.
    const { app, provided } = fakeApp()
    provideGranularityI18n(app as never, adapter)

    expect(provided.map(([k]) => k)).toEqual([
      Symbol.for('@feugene/granularity'),
      Symbol.for('FintI18n'),
    ])
    expect(provided.every(([, v]) => v === adapter)).toBe(true)
  })

  it('`alsoFintKey: false` оставляет только ключ ядра', () => {
    const { app, provided } = fakeApp()
    provideGranularityI18n(app as never, adapter, { alsoFintKey: false })

    expect(provided.map(([k]) => k)).toEqual([Symbol.for('@feugene/granularity')])
  })
})
