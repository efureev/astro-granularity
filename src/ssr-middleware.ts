import type { ThemeHead } from './theme-head'
import { buildPageSnapshot, injectSnapshot, serializeSnapshot } from './ssr'
import { runPage } from './ssr-store'
import { applyThemeHead } from './theme-head'

/**
 * Контекст Astro описан структурно, а не импортом `APIContext`.
 *
 * Нужны ровно эти поля, а структурная форма даёт покрыть фабрику юнит-тестом:
 * поднимать ради этого настоящий рендер Astro не пришлось бы никому.
 */
export type GranularityMiddlewareContext = {
  currentLocale?: string | undefined
  url: URL
  isPrerendered?: boolean
  request?: { headers: { get: (name: string) => string | null } }
}

export type GranularityMiddlewareNext = () => Promise<Response>

export type SSRMiddlewareInput = {
  /** Язык, когда маршрут ничего не сказал. */
  defaultLocale: string
  /** Языки приложения — для разбора пути, когда `currentLocale` пуст. */
  locales: string[]
  /** Скрипт режима по манифесту сборки; `null` — подменять нечего (`theme-head.ts`). */
  themeHead?: ThemeHead | null
}

/**
 * Первый сегмент пути, если он назван локалью приложения.
 *
 * Запасной путь для проектов без блока `i18n` в `astro.config`: там
 * `context.currentLocale` — `undefined`, и разобрать маршрут больше нечем.
 */
function matchFirstSegment(pathname: string, locales: string[]): string | null {
  const segment = pathname.split('/').find(part => part.length > 0)
  return segment && locales.includes(segment) ? segment : null
}

/**
 * Middleware, который сообщает локаль страницы до рендера и вкладывает снимок
 * строк после него.
 *
 * Локаль объявляется здесь, потому что больше негде: `@astrojs/vue` передаёт в
 * точку входа только `app`, а маршрут остаётся у Astro. Без этого объявления
 * `readPageLocale` на сборке возвращает `defaultLocale` — и `/ru/` рендерится
 * английским.
 *
 * Фабрика вынесена из `middleware.ts` по той же причине, что
 * `createVirtualI18nPlugin`: виртуальный модуль в vitest не резолвится, и
 * покрыть тестом можно только то, что от него не зависит.
 */
export function createGranularitySSRMiddleware({ defaultLocale, locales, themeHead = null }: SSRMiddlewareInput) {
  return async (
    context: GranularityMiddlewareContext,
    next: GranularityMiddlewareNext,
  ): Promise<Response> => {
    const locale = context.currentLocale ?? matchFirstSegment(context.url.pathname, locales) ?? defaultLocale
    // На пререндере заголовков запроса нет, и Astro предупреждает о каждом обращении к ним.
    const cookie = context.isPrerendered ? null : context.request?.headers.get('cookie') ?? null

    /*
     * Весь рендер — внутри контекста страницы. Пары «открыть/закрыть» больше
     * нет, и состоянию неоткуда утечь в соседний запрос: контекст уходит вместе
     * со стеком, в том числе когда рендер упал.
     */
    return runPage({ locale, cookie }, async () => {
      const response = await next()

      if (!(response.headers.get('content-type') ?? '').includes('text/html'))
        return response

      /*
       * Тело дочитывается ДО сборки снимка, и порядок здесь несущий.
       *
       * Под адаптером Astro отдаёт ответ потоком: `next()` возвращается раньше,
       * чем страница отрисована, и к этому моменту не переведено ещё ни одного
       * ключа. Снимок, собранный тут, выходил пустым — а пустой снимок
       * неотличим от «строк на странице нет», поэтому фича тихо выключалась,
       * оставаясь включённой. На статической сборке потока нет, и расхождение
       * ничем себя не обнаруживало.
       *
       * Платой идёт стриминг: страницу приходится собрать целиком. Он и так
       * терялся на каждой странице со строками — вставить снимок в поток нечем.
       */
      const text = await response.text()
      const html = themeHead ? applyThemeHead(text, themeHead) : text
      const headers = new Headers(response.headers)
      // Длина тела изменилась. На статической сборке заголовок не выставлен и
      // так, но за адаптером он отдал бы обрезанную страницу.
      headers.delete('content-length')
      const rest = { status: response.status, statusText: response.statusText, headers }

      const snapshot = buildPageSnapshot()
      if (!snapshot)
        return new Response(html, rest)

      return new Response(injectSnapshot(html, serializeSnapshot(snapshot)), rest)
    })
  }
}

/**
 * Middleware одного скрипта режима — для приложения без снимка строк
 * (`i18n: false` или `ssrStrings: false`): подменять скрипт ему тоже нужно, а
 * модуля строк у него нет.
 */
export function createThemeHeadMiddleware(themeHead: ThemeHead) {
  return async (_context: GranularityMiddlewareContext, next: GranularityMiddlewareNext): Promise<Response> => {
    const response = await next()
    if (!(response.headers.get('content-type') ?? '').includes('text/html'))
      return response
    const headers = new Headers(response.headers)
    headers.delete('content-length')
    const html = applyThemeHead(await response.text(), themeHead)
    return new Response(html, { status: response.status, statusText: response.statusText, headers })
  }
}
