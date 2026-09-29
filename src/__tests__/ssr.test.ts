import type { GranularityI18nSnapshot } from '../ssr'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildPageSnapshot,
  injectSnapshot,
  readServerPageLocale,
  recordUsedKey,
  registerSnapshotBuilder,
  serializeSnapshot,
  SNAPSHOT_ATTR,
  usedKeys,
} from '../ssr'
import { runPage } from '../ssr-store'

const snapshot = (messages: GranularityI18nSnapshot['messages']): GranularityI18nSnapshot =>
  ({ locale: 'ru', messages, blocks: {} })

describe('serializeSnapshot', () => {
  it('экранирует `<`, поэтому перевод с `</script>` не закрывает тег', () => {
    const json = serializeSnapshot(snapshot({ ru: { gr: { note: 'до </script> и после' } } }))

    expect(json).not.toContain('</script>')
    expect(json).not.toContain('<')
    expect(json).toContain('\\u003c/script>')
  })

  it('экранированное переживает round-trip: `JSON.parse` возвращает исходный `<`', () => {
    const original = snapshot({ ru: { gr: { note: '<b>жирный</b> и <!-- комментарий -->' } } })

    expect(JSON.parse(serializeSnapshot(original))).toEqual(original)
  })

  it('экранирует и `<!--`: в raw-text элементе это второй способ выйти', () => {
    expect(serializeSnapshot(snapshot({ ru: { gr: { note: '<!--' } } }))).not.toContain('<!--')
  })
})

describe('injectSnapshot', () => {
  const HEAD = '<html><head><meta charset="utf-8"><title>т</title></head><body>тело</body></html>'

  it('вставляет блок перед `</head>`', () => {
    const html = injectSnapshot(HEAD, '{"locale":"ru"}')

    expect(html).toContain(`<script type="application/json" ${SNAPSHOT_ATTR}>{"locale":"ru"}</script></head>`)
  })

  it('не выталкивает `<meta charset>` за первые 1024 байта', () => {
    // Вставка сразу после `<head>` сдвинула бы charset за границу, после которой
    // браузер перестаёт его учитывать и начинает угадывать кодировку.
    const big = `{"locale":"ru","messages":${JSON.stringify({ ru: { gr: { pad: 'я'.repeat(1500) } } })}}`

    const html = injectSnapshot(HEAD, big)

    expect(html.length).toBeGreaterThan(1500)
    expect(html.indexOf('<meta charset')).toBeLessThan(1024)
  })

  it('без `</head>` возвращает разметку нетронутой', () => {
    const fragment = '<div>фрагмент</div>'

    expect(injectSnapshot(fragment, '{"locale":"ru"}')).toBe(fragment)
  })
})

describe('контекст страницы', () => {
  beforeEach(() => {
    registerSnapshotBuilder(() => null)
  })

  it('вне рендера страницы локали нет, а запись ключа ничего не делает', () => {
    expect(readServerPageLocale()).toBeNull()
    expect(() => recordUsedKey('gr.pagination.next')).not.toThrow()
    expect(usedKeys()).toEqual([])
  })

  it('журнал живёт ровно внутри рендера и наружу не выходит', async () => {
    await runPage('ru', async () => {
      recordUsedKey('gr.pagination.next')
      expect(readServerPageLocale()).toBe('ru')
      expect(usedKeys()).toEqual(['gr.pagination.next'])
    })

    expect(readServerPageLocale()).toBeNull()
    expect(usedKeys()).toEqual([])
  })

  it('ключи не дублируются', async () => {
    await runPage('ru', async () => {
      recordUsedKey('gr.pagination.next')
      recordUsedKey('gr.pagination.next')

      expect(usedKeys()).toEqual(['gr.pagination.next'])
    })
  })

  /*
   * То, ради чего заведён `AsyncLocalStorage`, и то, чего модульная переменная
   * не умела в принципе: два рендера идут одновременно, и ни локаль, ни журнал
   * одного не видны другому. Раньше на этом месте фича просто выключалась —
   * под адаптером и при `build.concurrency > 1`.
   */
  it('параллельные рендеры не видят состояния друг друга', async () => {
    const seen: Record<string, { locale: string | null, used: readonly string[] }> = {}

    const render = (locale: string, key: string, pause: number) => runPage(locale, async () => {
      recordUsedKey(key)
      // Уступаем управление посреди рендера: именно здесь модульная переменная
      // и затиралась соседом.
      await new Promise(done => setTimeout(done, pause))
      seen[locale] = { locale: readServerPageLocale(), used: usedKeys() }
    })

    await Promise.all([
      render('ru', 'gr.pagination.next', 20),
      render('en', 'gr.pagination.prev', 5),
      render('es', 'gr.select.clear', 12),
    ])

    expect(seen).toEqual({
      ru: { locale: 'ru', used: ['gr.pagination.next'] },
      en: { locale: 'en', used: ['gr.pagination.prev'] },
      es: { locale: 'es', used: ['gr.select.clear'] },
    })
  })
})

describe('buildPageSnapshot', () => {
  it('вне страницы — `null`', () => {
    registerSnapshotBuilder(() => snapshot({ ru: { gr: {} } }))

    expect(buildPageSnapshot()).toBeNull()
  })

  it('отдаёт построителю локаль и журнал текущей страницы', async () => {
    let seen: { locale: string, used: readonly string[] } | null = null
    registerSnapshotBuilder((locale, used) => {
      seen = { locale, used }
      return snapshot({ ru: { gr: {} } })
    })

    await runPage('ru', async () => {
      recordUsedKey('gr.pagination.prev')
      buildPageSnapshot()
    })

    expect(seen).toEqual({ locale: 'ru', used: ['gr.pagination.prev'] })
  })
})
