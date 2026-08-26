/// <reference path="../client.d.ts" />
import type { LocaleLoaderSource } from '@feugene/fint-i18n/core'
import type { App } from 'vue'
import { blocks, defaultLocale, loaders } from 'virtual:granularity/i18n'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { readPageLocale } from './runtime'

type FintI18n = ReturnType<typeof createFintI18n>

/**
 * Готовая обвязка на `@feugene/fint-i18n` — точка входа для
 * `vue({ appEntrypoint: '@feugene/astro-granularity/app' })`.
 *
 * Формат лоадеров, который публикуют пакеты экосистемы, — fint-овский
 * (`LocaleLoaderCollection`), поэтому здесь он и подключается напрямую.
 * Приложению с другим i18n-рантаймом эта точка входа не нужна: оно пишет свою
 * и раздаёт адаптер через `provideGranularityI18n` из
 * `@feugene/astro-granularity/runtime`, а лоадеры конвертирует само.
 */
let instance: FintI18n | null = null

/**
 * Один экземпляр на страницу, а не на остров.
 *
 * Острова Astro — независимые корни Vue, но граф модулей у них общий: этот
 * модуль исполняется один раз, и все острова получают тот же экземпляр. Без
 * синглтона каждый остров грузил бы словарь заново, а переключение языка в
 * одном не доходило бы до остальных.
 */
export function getGranularityI18n(): FintI18n {
  if (instance)
    return instance

  const locale = readPageLocale(defaultLocale)
  instance = createFintI18n({
    locale,
    fallbackLocale: defaultLocale,
    // Без этого `fallbackLocale` объявлен, но пуст до первого переключения
    // языка, и отсутствующий ключ показывает сам ключ, а не английский текст.
    preloadFallback: true,
    // Приведение — единственное место, где форма лоадеров встречается с типами
    // `fint-i18n`. `runtime.ts` описывает её структурно (`Record<локаль,
    // Record<блок, unknown>>`) и намеренно не импортирует fint: приложение
    // вправе взять другой рантайм. Здесь fint уже выбран, и лист сужается до
    // `LocaleBlockLoaders`.
    loaders: loaders as LocaleLoaderSource,
  })
  // Блоки выведены из самих лоадеров: имя блока лежит внутри коллекции вторым
  // уровнем ключа, поэтому приложению не нужно перечислять `*_I18N_BLOCK`.
  instance.registerBlocks(blocks)
  if (loaders.length > 0 && blocks.length === 0) {
    // Пустой список при непустых лоадерах означает, что какой-то пакет отдаёт
    // не `{ локаль: { блок: лоадер } }`. Строки при этом молча уйдут в
    // английский fallback, поэтому говорим вслух — но не роняем страницу.
    console.warn(
      '[astro-granularity] лоадеры есть, а блоков не выведено ни одного. '
      + 'Вероятно, подключён пакет, чей `/i18n` отдаёт не `{ локаль: { блок: лоадер } }`.',
    )
  }
  void instance.loadUsedBlocks(locale)
  return instance
}

/** Точка входа для `vue({ appEntrypoint: '@feugene/astro-granularity/app' })`. */
export default function setup(app: App): void {
  installI18n(app, getGranularityI18n())
}
