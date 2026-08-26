/**
 * Типы виртуального модуля, который интеграция порождает на сборке.
 *
 * Файл публикуется как есть (`files`, подпуть `./client`) и подключается
 * приложением, которое пишет свою точку входа:
 *
 * ```ts
 * /// <reference types="@feugene/astro-granularity/client" />
 * ```
 */
declare module 'virtual:granularity/i18n' {
  import type { GranularityLocaleLoaders } from '@feugene/astro-granularity/runtime'

  /** Коллекции лоадеров подключённых пакетов, уже уплощённые. */
  export const loaders: GranularityLocaleLoaders[]
  /** Имена блоков, выведенные из `loaders`. */
  export const blocks: string[]
  /** Язык из `config.i18n.defaultLocale` Astro; запасной для `<html lang>`. */
  export const defaultLocale: string
  /** Языки приложения из опции `i18n.locales`; пусто при агрегате `/i18n/all`. */
  export const locales: string[]
  /** Объём снимка строк в HTML из опции `i18n.ssrStrings`. */
  export const ssrStrings: 'used' | 'full' | false
}
