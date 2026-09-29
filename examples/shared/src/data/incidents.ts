import type { Locale } from '../i18n/ui'
import { getCollection } from 'astro:content'

/**
 * Отчёты одного языка, свежие сверху.
 *
 * Язык лежит первым сегментом `id` (`ru/queue-degradation`) — так его задаёт
 * структура каталогов, и второго источника правды заводить незачем.
 */
export async function incidentsFor(locale: Locale) {
  const all = await getCollection('incidents', entry => entry.id.startsWith(`${locale}/`))
  return all
    .map(entry => ({ entry, slug: entry.id.slice(locale.length + 1) }))
    .sort((a, b) => b.entry.data.date.getTime() - a.entry.data.date.getTime())
}

/**
 * Один отчёт по языку и слагу — для маршрутов, которые собираются на запрос.
 *
 * `getStaticPaths()` при `output: 'server'` игнорируется, и запись приходится
 * искать в момент запроса. Отсюда `undefined` в контракте: слаг приходит из
 * URL, а не из списка, который построила сборка.
 */
export async function incidentBySlug(locale: Locale, slug: string | undefined) {
  if (!slug)
    return undefined
  const list = await incidentsFor(locale)
  return list.find(item => item.slug === slug)?.entry
}
