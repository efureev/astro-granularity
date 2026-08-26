import { beforeEach, describe, expect, it } from 'vitest'
import { endPage, readServerPageLocale, registerSnapshotBuilder, SNAPSHOT_ATTR } from '../ssr'
import { createGranularitySSRMiddleware } from '../ssr-middleware'

const middleware = createGranularitySSRMiddleware({ defaultLocale: 'en', locales: ['en', 'ru'] })

const context = (pathname: string, currentLocale?: string) =>
  ({ url: new URL(`https://example.test${pathname}`), currentLocale })

const html = (body: string) =>
  new Response(`<html><head></head><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })

/** Локаль, которую middleware объявил на время рендера. */
async function declaredLocale(pathname: string, currentLocale?: string): Promise<string | null> {
  let seen: string | null = null
  await middleware(context(pathname, currentLocale), async () => {
    seen = readServerPageLocale()
    return html('тело')
  })
  return seen
}

describe('локаль страницы', () => {
  beforeEach(() => {
    endPage()
    registerSnapshotBuilder(() => null)
  })

  it('берётся из `currentLocale`, когда Astro её знает', async () => {
    expect(await declaredLocale('/ru/', 'ru')).toBe('ru')
  })

  it('без `currentLocale` разбирается первый сегмент пути', async () => {
    // Так выглядит проект без блока `i18n` в `astro.config`: маршрут локаль
    // несёт, а Astro о ней не знает.
    expect(await declaredLocale('/ru/страница')).toBe('ru')
  })

  it('сегмент, не названный локалью приложения, не принимается за неё', async () => {
    expect(await declaredLocale('/blog/пост')).toBe('en')
  })

  it('корень отдаёт `defaultLocale`', async () => {
    expect(await declaredLocale('/')).toBe('en')
  })

  it('снимается после рендера, даже когда страница упала', async () => {
    // Иначе состояние упавшей страницы досталось бы следующей, и та отрисовалась
    // бы чужим языком.
    await expect(middleware(context('/ru/', 'ru'), async () => {
      throw new Error('рендер упал')
    })).rejects.toThrow('рендер упал')

    expect(readServerPageLocale()).toBeNull()
  })
})

describe('вложение снимка', () => {
  beforeEach(() => {
    endPage()
  })

  it('кладёт блок в HTML и убирает `content-length`', async () => {
    registerSnapshotBuilder(locale => ({ locale, messages: { ru: { gr: { a: 'б' } } }, blocks: {} }))
    const response = new Response('<html><head></head><body>т</body></html>', {
      headers: { 'content-type': 'text/html', 'content-length': '40' },
    })

    const result = await middleware(context('/ru/', 'ru'), async () => response)
    const text = await result.text()

    expect(text).toContain(`<script type="application/json" ${SNAPSHOT_ATTR}>`)
    expect(text).toContain('"locale":"ru"')
    // Длина тела изменилась: оставленный заголовок отдал бы обрезанную страницу
    // за адаптером `output: 'server'`.
    expect(result.headers.get('content-length')).toBeNull()
    expect(result.headers.get('content-type')).toBe('text/html')
  })

  it('пустой снимок оставляет ответ тем же объектом', async () => {
    registerSnapshotBuilder(() => null)
    const response = html('т')

    expect(await middleware(context('/ru/', 'ru'), async () => response)).toBe(response)
  })

  it('не-HTML ответ проходит тем же объектом', async () => {
    registerSnapshotBuilder(locale => ({ locale, messages: { ru: { gr: {} } }, blocks: {} }))
    const response = new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })

    expect(await middleware(context('/ru/', 'ru'), async () => response)).toBe(response)
  })

  it('сохраняет статус и текст статуса', async () => {
    registerSnapshotBuilder(locale => ({ locale, messages: { ru: { gr: { a: 'б' } } }, blocks: {} }))
    const response = new Response('<html><head></head><body>нет</body></html>', {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'text/html' },
    })

    const result = await middleware(context('/ru/', 'ru'), async () => response)

    expect(result.status).toBe(404)
    expect(result.statusText).toBe('Not Found')
  })
})
