/**
 * Виртуальный модуль с настройками режима для точки входа `./app`: ключ
 * хранилища и cookie из опций интеграции. Манифест режимов точка входа берёт у
 * granum (`virtual:granum/themes`) — второго источника пар нет.
 */

export const VIRTUAL_THEME_ID = 'virtual:granularity/theme'

export type VirtualThemeInput = {
  storageKey: string
  cookie: string | undefined
}

/** Структурный тип плагина: `vite` в зависимости пакета не тянем. */
export type VirtualThemePlugin = {
  name: string
  resolveId: (id: string) => string | null
  load: (id: string) => string | null
}

const RESOLVED_ID = `\0${VIRTUAL_THEME_ID}`

export function buildThemeModuleSource(input: VirtualThemeInput): string {
  return `export const storageKey = ${JSON.stringify(input.storageKey)}\n`
    + `export const cookie = ${JSON.stringify(input.cookie ?? null)}\n`
}

export function createVirtualThemePlugin(input: VirtualThemeInput): VirtualThemePlugin {
  const source = buildThemeModuleSource(input)
  return {
    name: 'astro-granularity:theme',
    resolveId: id => (id === VIRTUAL_THEME_ID ? RESOLVED_ID : null),
    load: id => (id === RESOLVED_ID ? source : null),
  }
}
