import type { GranularityI18nSnapshot } from '../ssr'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginPage,
  buildPageSnapshot,
  endPage,
  injectSnapshot,
  readServerPageLocale,
  recordUsedKey,
  registerSnapshotBuilder,
  serializeSnapshot,
  SNAPSHOT_ATTR,
  usedKeys,
} from '../ssr'

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
    endPage()
    registerSnapshotBuilder(() => null)
  })

  it('вне рендера страницы локали нет, а запись ключа ничего не делает', () => {
    expect(readServerPageLocale()).toBeNull()
    expect(() => recordUsedKey('gr.pagination.next')).not.toThrow()
    expect(usedKeys()).toEqual([])
  })

  it('`endPage` изолирует журнал: ключи одной страницы не текут в следующую', () => {
    beginPage('ru')
    recordUsedKey('gr.pagination.next')
    expect(usedKeys()).toEqual(['gr.pagination.next'])

    endPage()
    beginPage('en')

    expect(readServerPageLocale()).toBe('en')
    expect(usedKeys()).toEqual([])
  })

  it('ключи не дублируются', () => {
    beginPage('ru')
    recordUsedKey('gr.pagination.next')
    recordUsedKey('gr.pagination.next')

    expect(usedKeys()).toEqual(['gr.pagination.next'])
  })
})

describe('buildPageSnapshot', () => {
  beforeEach(() => {
    endPage()
  })

  it('вне страницы — `null`', () => {
    registerSnapshotBuilder(() => snapshot({ ru: { gr: {} } }))

    expect(buildPageSnapshot()).toBeNull()
  })

  it('отдаёт построителю локаль и журнал текущей страницы', () => {
    let seen: { locale: string, used: readonly string[] } | null = null
    registerSnapshotBuilder((locale, used) => {
      seen = { locale, used }
      return snapshot({ ru: { gr: {} } })
    })

    beginPage('ru')
    recordUsedKey('gr.pagination.prev')
    buildPageSnapshot()

    expect(seen).toEqual({ locale: 'ru', used: ['gr.pagination.prev'] })
  })
})
