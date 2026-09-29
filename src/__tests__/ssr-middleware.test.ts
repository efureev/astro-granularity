import { beforeEach, describe, expect, it } from 'vitest'
import { readServerPageLocale, registerSnapshotBuilder, SNAPSHOT_ATTR } from '../ssr'
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
    // Контекст уходит вместе со стеком, поэтому состояние упавшей страницы
    // не достаётся следующей ни при каком стечении обстоятельств.
    await expect(middleware(context('/ru/', 'ru'), async () => {
      throw new Error('рендер упал')
    })).rejects.toThrow('рендер упал')

    expect(readServerPageLocale()).toBeNull()
  })
})

describe('вложение снимка', () => {
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

  it('пустой снимок оставляет тело нетронутым', async () => {
    registerSnapshotBuilder(() => null)
    const response = html('т')

    const result = await middleware(context('/ru/', 'ru'), async () => response)
    const text = await result.text()

    // Тем же ОБЪЕКТОМ ответ вернуться уже не может: чтобы узнать, есть ли что
    // класть в снимок, тело приходится дочитать. Контракт — в содержимом.
    expect(text).toBe('<html><head></head><body>т</body></html>')
    expect(text).not.toContain(SNAPSHOT_ATTR)
    expect(result.status).toBe(200)
  })

  /*
   * Под адаптером Astro отдаёт страницу потоком, и `next()` возвращается
   * раньше, чем она отрисована. Снимок, собранный до чтения тела, выходит
   * пустым — и фича тихо выключается, оставаясь включённой.
   *
   * Здесь ключ «переводится» ровно в момент чтения тела: до него построитель
   * снимка отдаёт `null`, как настоящий сборщик, пока не переведено ничего.
   */
  it('снимок собирается после того, как тело дочитано', async () => {
    let rendered = false
    registerSnapshotBuilder(locale => (rendered ? { locale, messages: { ru: { gr: { a: 'б' } } }, blocks: {} } : null))
    const response = html('т')
    const readBody = response.text.bind(response)
    Object.defineProperty(response, 'text', {
      value: async () => {
        rendered = true
        return readBody()
      },
    })

    const result = await middleware(context('/ru/', 'ru'), async () => response)
    const text = await result.text()

    expect(text).toContain(SNAPSHOT_ATTR)
    expect(text).toContain('"locale":"ru"')
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
