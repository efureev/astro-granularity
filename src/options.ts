export type ThemeName = 'light' | 'dark'
export type DefaultTheme = ThemeName | 'system'

/**
 * Ключ и атрибут согласованы с `useTheme` ядра
 * (`packages/granularity/src/composables/useTheme.ts`). Расхождение означает,
 * что инлайн-скрипт и рантайм выберут разные темы, и страница мигнёт — ровно
 * то, ради чего скрипт и существует. Держится гейтом `theme-script.test.ts`.
 */
export const DEFAULT_STORAGE_KEY = 'gr-theme'

export type GranularityAstroOptions = {
  /** Тема при отсутствии сохранённого выбора. */
  defaultTheme?: DefaultTheme
  /** Ключ хранилища выбора темы. */
  themeStorageKey?: string
  /** Вставлять ли скрипт темы. Выключается, когда приложение ставит `data-theme` само. */
  injectThemeScript?: boolean
  /**
   * Импортировать бандл `@feugene/granularity/styles.css`.
   *
   * По умолчанию `false`, и это не осторожность: при работающем
   * `presetGranularNode` темы, токены и базовый слой уже приезжают из
   * `virtual:uno.css` как preflights. Импорт бандла удвоил бы их. Включается
   * только для сборок без UnoCSS.
   */
  injectStyleBundle?: boolean
  /** Регистрировать ли резолвер авто-импорта. */
  resolver?: boolean
  /**
   * Виртуальный модуль с лоадерами строк.
   *
   * `false` — не порождать вовсе: приложение подключает словари само. Каждая
   * автоматическая вещь пакета выключается флагом, и это не исключение.
   */
  i18n?: GranularityI18nOptions | false
  /** Ронять сборку на проблемах окружения или ограничиться предупреждением. */
  strict?: boolean
}

export type GranularityI18nOptions = {
  /**
   * Спутники, чьи строки подключить помимо ядра. Ядро подключается всегда.
   *
   * Имя блока из списка не выводится и не нужен: он лежит внутри самих
   * лоадеров, и `deriveI18nBlocks` берёт его оттуда.
   */
  packages?: string[]
  /**
   * Языки приложения. Пусто — берётся агрегат `<pkg>/i18n/all` со всеми, что
   * есть у пакета.
   *
   * Явный список включает импорт именованных локалей, и неиспользуемые языки
   * отсекаются сборкой: пакет с `en`/`ru`/`es` при `locales: ['en','ru']`
   * отдаёт в `dist` только два чанка.
   */
  locales?: string[]
}

export type ResolvedOptions = Required<Omit<GranularityAstroOptions, 'i18n'>> & {
  i18n: { packages: string[], locales: string[] } | false
}

const DEFAULTS: ResolvedOptions = {
  defaultTheme: 'system',
  themeStorageKey: DEFAULT_STORAGE_KEY,
  injectThemeScript: true,
  injectStyleBundle: false,
  resolver: true,
  i18n: { packages: [], locales: [] },
  strict: true,
}

function resolveI18n(i18n: GranularityAstroOptions['i18n']): ResolvedOptions['i18n'] {
  if (i18n === false)
    return false
  if (i18n !== undefined && (typeof i18n !== 'object' || i18n === null || Array.isArray(i18n)))
    throw new TypeError('[astro-granularity] i18n: ожидался объект настроек или `false`.')

  return {
    packages: [...(i18n?.packages ?? [])],
    locales: [...(i18n?.locales ?? [])],
  }
}

export function resolveOptions(options: GranularityAstroOptions = {}): ResolvedOptions {
  const defaultTheme = options.defaultTheme ?? DEFAULTS.defaultTheme
  if (defaultTheme !== 'light' && defaultTheme !== 'dark' && defaultTheme !== 'system') {
    throw new TypeError(
      `[astro-granularity] defaultTheme: ожидалось 'light' | 'dark' | 'system', получено ${JSON.stringify(defaultTheme)}.`,
    )
  }

  const themeStorageKey = options.themeStorageKey ?? DEFAULTS.themeStorageKey
  if (typeof themeStorageKey !== 'string' || themeStorageKey.length === 0)
    throw new TypeError('[astro-granularity] themeStorageKey: ожидалась непустая строка.')

  return {
    defaultTheme,
    themeStorageKey,
    injectThemeScript: options.injectThemeScript ?? DEFAULTS.injectThemeScript,
    injectStyleBundle: options.injectStyleBundle ?? DEFAULTS.injectStyleBundle,
    resolver: options.resolver ?? DEFAULTS.resolver,
    i18n: resolveI18n(options.i18n),
    strict: options.strict ?? DEFAULTS.strict,
  }
}
