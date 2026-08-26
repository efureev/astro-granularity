import type { SSRStringsMode } from './options'
import { buildI18nModuleSource, VIRTUAL_I18N_ID } from './i18n'

/**
 * Плагин, отдающий виртуальный модуль с лоадерами строк.
 *
 * Вынесен из хука интеграции, потому что иначе его нельзя покрыть юнит-тестом:
 * `astro:config:setup` требует настоящего конфига Astro, а проверять здесь надо
 * ровно две вещи — что резолвится только свой id и что отказ объясняется.
 */

export type VirtualI18nInput = {
  packages: string[]
  locales: string[]
  defaultLocale: string
  ssrStrings: SSRStringsMode
}

/** Структурный тип плагина: `vite` в зависимости пакета не тянем. */
export type VirtualI18nPlugin = {
  name: string
  resolveId: (id: string) => string | null
  load: (id: string) => string | null
}

const RESOLVED_ID = `\0${VIRTUAL_I18N_ID}`

/**
 * @param input Состав модуля, либо `false` — модуль выключен опцией `i18n`.
 */
export function createVirtualI18nPlugin(input: VirtualI18nInput | false): VirtualI18nPlugin {
  // Исходник считается один раз: состав зависит только от опций, а правка
  // конфига перезапускает dev-сервер целиком.
  const source = input === false ? null : buildI18nModuleSource(input)

  return {
    name: 'astro-granularity:i18n',

    resolveId(id) {
      return id === VIRTUAL_I18N_ID ? RESOLVED_ID : null
    },

    load(id) {
      if (id !== RESOLVED_ID)
        return null
      if (source === null) {
        // `resolveId` отвечает и при выключенном модуле намеренно. Иначе
        // забытый `appEntrypoint` даёт сырое вайтовое «Failed to resolve
        // import» с виртуальным id в тексте, и причину ищут в приложении.
        throw new Error(
          `[astro-granularity] модуль ${VIRTUAL_I18N_ID} выключен опцией \`i18n: false\`, `
          + 'но кто-то его импортирует.\n'
          + '  Скорее всего остался `vue({ appEntrypoint: \'@feugene/astro-granularity/app\' })` — '
          + 'уберите его либо верните настройки `i18n`.',
        )
      }
      return source
    },
  }
}
