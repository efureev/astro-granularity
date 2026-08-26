import { beginPage, buildPageSnapshot, endPage, injectSnapshot, serializeSnapshot } from './ssr'

/**
 * Контекст Astro описан структурно, а не импортом `APIContext`.
 *
 * Нужны ровно два поля, а структурная форма даёт покрыть фабрику юнит-тестом:
 * поднимать ради этого настоящий рендер Astro не пришлось бы никому.
 */
export type GranularityMiddlewareContext = {
  currentLocale?: string | undefined
  url: URL
}

export type GranularityMiddlewareNext = () => Promise<Response>

export type SSRMiddlewareInput = {
  /** Язык, когда маршрут ничего не сказал. */
  defaultLocale: string
  /** Языки приложения — для разбора пути, когда `currentLocale` пуст. */
  locales: string[]
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
export function createGranularitySSRMiddleware({ defaultLocale, locales }: SSRMiddlewareInput) {
  return async (
    context: GranularityMiddlewareContext,
    next: GranularityMiddlewareNext,
  ): Promise<Response> => {
    const locale = context.currentLocale ?? matchFirstSegment(context.url.pathname, locales) ?? defaultLocale

    beginPage(locale)
    try {
      const response = await next()

      if (!(response.headers.get('content-type') ?? '').includes('text/html'))
        return response

      const snapshot = buildPageSnapshot()
      if (!snapshot)
        return response

      const html = injectSnapshot(await response.text(), serializeSnapshot(snapshot))
      const headers = new Headers(response.headers)
      // Длина тела изменилась. На статической сборке заголовок не выставлен и
      // так, но за адаптером `output: 'server'` он отдал бы обрезанную страницу.
      headers.delete('content-length')
      return new Response(html, { status: response.status, statusText: response.statusText, headers })
    }
    finally {
      // В `finally`, а не после `next()`: страница, упавшая на рендере, иначе
      // оставила бы своё состояние следующей.
      endPage()
    }
  }
}
