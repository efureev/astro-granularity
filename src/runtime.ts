import type { App } from 'vue'

/**
 * Браузерная часть пакета: то, что исполняется в островах, а не на сборке.
 *
 * Здесь нет импортов из `@feugene/fint-i18n` даже в типах — приложение вправе
 * взять другой i18n-рантайм. Формы описаны структурно.
 */

/**
 * Коллекция лоадеров локали: `{ <локаль>: { <блок>: лоадер } }`.
 *
 * Ровно два уровня, и это форма `fint-i18n`, которой следуют все пакеты
 * экосистемы. Значение листа не типизируется: у `fint-i18n` это функция либо
 * массив функций, а нам оно безразлично — мы читаем только ключи.
 */
export type GranularityLocaleLoaders = Record<string, Record<string, unknown>>

/**
 * Имена блоков, которые несут переданные лоадеры.
 *
 * Имя блока лежит **внутри** коллекции вторым уровнем ключа
 * (`{ en: { gr: () => import(...) } }`), поэтому реестра «пакет → имя константы»
 * не нужно: список выводится из тех же данных, которые и так импортированы.
 * Без этого приложение обязано перечислять `GRANULARITY_I18N_BLOCK`,
 * `GR_CHRONO_I18N_BLOCK` и так далее руками — а имена констант не выводятся из
 * имени пакета (`granularity-forms-schema` объявляет `grForms`).
 *
 * Порядок сохраняется: `registerBlocks` ведёт счётчик ссылок, и стабильный
 * порядок делает поведение воспроизводимым.
 */
export function deriveI18nBlocks(loaders: readonly GranularityLocaleLoaders[]): string[] {
  const blocks: string[] = []
  for (const collection of loaders) {
    for (const byBlock of Object.values(collection)) {
      for (const block of Object.keys(byBlock)) {
        if (!blocks.includes(block))
          blocks.push(block)
      }
    }
  }
  return blocks
}

/**
 * Язык страницы из `<html lang>`.
 *
 * На статической сборке это единственный источник, знающий локаль текущей
 * страницы: маршрут разобран на сборке, и остров о нём из пропсов не знает.
 */
export function readPageLocale(defaultLocale: string): string {
  if (typeof document === 'undefined')
    return defaultLocale
  const lang = document.documentElement.lang?.trim()
  return lang && lang.length > 0 ? lang : defaultLocale
}

/** Минимум, который ядро спрашивает у переводчика (`GranularityI18nAdapter`). */
export type GranularityI18nAdapterLike = {
  t: (key: string, params?: Record<string, unknown>) => string
  te?: (key: string) => boolean
}

/** Ключ, под которым ядро ищет адаптер. Совпадает с `GRANULARITY_I18N_KEY`. */
const GRANULARITY_I18N_KEY = Symbol.for('@feugene/granularity')
/** Ключ, под которым `installI18n` кладёт инстанс `fint-i18n`. */
const FINT_I18N_KEY = Symbol.for('FintI18n')

export type ProvideI18nOptions = {
  /**
   * Класть адаптер и под ключ `fint-i18n`.
   *
   * По умолчанию `true`, и это защита, а не удобство: пакеты экосистемы, не
   * перешедшие на `useGranularityTranslations` ядра, ищут инстанс только по
   * `Symbol.for('FintI18n')`. Провайд под одним ключом ядра даёт у них молчаливый
   * английский fallback вместо перевода.
   *
   * Выключайте, если приложение само зовёт `installI18n` — иначе два провайда
   * борются за один ключ, и побеждает последний.
   */
  alsoFintKey?: boolean
}

/**
 * Отдаёт адаптер компонентам острова.
 *
 * Приложение вольно собрать адаптер над любым i18n-рантаймом: ядро спрашивает
 * только `t` и, если умеет, `te`.
 */
export function provideGranularityI18n(
  app: App,
  adapter: GranularityI18nAdapterLike,
  options: ProvideI18nOptions = {},
): void {
  app.provide(GRANULARITY_I18N_KEY, adapter)
  if (options.alsoFintKey ?? true)
    app.provide(FINT_I18N_KEY, adapter)
}

/**
 * Шов для приложения, которое пишет свою точку входа.
 *
 * Локаль страницы на сборке объявляет middleware интеграции, а снимок строк
 * лежит в разметке — обе величины доступны и тому, кто взял другой i18n-рантайм.
 * Реэкспорт, а не копия: `ssr.ts` обязан быть одним модулем на сборку, иначе
 * состояние страницы разъедется между копиями и снимок выйдет пустым.
 */
export {
  type GranularityI18nSnapshot,
  readServerPageLocale,
  readSnapshotFromDocument,
  registerSnapshotBuilder,
  SNAPSHOT_ATTR,
} from './ssr'
