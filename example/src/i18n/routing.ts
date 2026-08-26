import type { Locale } from './ui'
import { defaultLocale, isLocale, locales } from './ui'

/**
 * Маршруты и их языковые двойники.
 *
 * Язык по умолчанию живёт без префикса (`prefixDefaultLocale: false`), остальные
 * — под своим: `/ru/`, `/es/`. Здесь это записано один раз, чтобы ссылки в меню,
 * `hreflang` и карта сайта не разъезжались между собой.
 */

export type PageKey = 'index' | 'settings'
export const pageKeys: readonly PageKey[] = ['index', 'settings']

export function localePath(locale: Locale, page: PageKey): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  return page === 'index' ? `${prefix}/` : `${prefix}/settings/`
}

/** Языковые двойники страницы — вход для `hreflang`. */
export function alternates(page: PageKey): { locale: Locale, path: string }[] {
  return locales.map(locale => ({ locale, path: localePath(locale, page) }))
}

/**
 * Локаль текущего маршрута.
 *
 * `Astro.currentLocale` знает её сам, но 404 отдаётся вне языкового маршрута, и
 * там значение приходится выводить из пути.
 */
export function localeFromPath(pathname: string): Locale {
  const segment = pathname.split('/').find(part => part.length > 0)
  return isLocale(segment) ? segment : defaultLocale
}
