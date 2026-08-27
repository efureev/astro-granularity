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
