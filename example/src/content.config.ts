import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

/**
 * Отчёты об инцидентах — по одному файлу на язык.
 *
 * Язык лежит в пути (`en/queue-degradation.md`), поэтому и в `id`. Отдельная
 * коллекция на каждый язык дала бы три схемы вместо одной и разъехалась бы при
 * первой же правке.
 */
const incidents = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/incidents' }),
  // Функция, а не объект: `image()` доступен только в этой форме. Он не просто
  // проверяет строку — он превращает путь в метаданные (размеры, формат),
  // без которых `<Image />` не сможет зарезервировать место.
  schema: ({ image }) => z.object({
    title: z.string(),
    /** Дата в фронтматтере — строка; приводим к `Date`, чтобы сортировать. */
    date: z.coerce.date(),
    /** `id` сервиса из `data/services.ts` — связывает отчёт с панелью. */
    service: z.string(),
    severity: z.enum(['minor', 'major', 'critical']),
    resolved: z.boolean().default(true),
    summary: z.string(),
    /** График к отчёту. Путь относительно файла отчёта. */
    chart: image().optional(),
    chartAlt: z.string().optional(),
  }),
})

export const collections = { incidents }
