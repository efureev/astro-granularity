/**
 * Ключ согласован с `GR_THEME_STORAGE_KEY` ядра: в нём лежит имя режима, и
 * его же читает `useTheme`. Расхождение означает, что инлайн-скрипт и рантайм
 * выберут разные режимы, и страница мигнёт — ровно то, ради чего скрипт и
 * существует. Держится гейтом `theme-script.test.ts`.
 */
export const DEFAULT_STORAGE_KEY = 'gr-theme'

export type GranularityAstroOptions = {
  /** Ключ `localStorage`, где лежит выбранный режим. */
  themeStorageKey?: string
  /**
   * Cookie с выбранным режимом — когда приложение хранит его в cookie
   * (`createCookieStorage` granum), чтобы сервер отдавал пару в HTML. Скрипт
   * читает её раньше `localStorage`.
   */
  themeCookie?: string
  /** Вставлять ли скрипт режима. Выключается, когда приложение ставит пару само. */
  injectThemeScript?: boolean
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
  /**
   * Класть строки в HTML на сборке, чтобы клиент не ждал их из сети.
   *
   * Без этого статическая страница приезжает с литеральными fallback'ами
   * компонентов и перещёлкивается на язык страницы после гидратации острова.
   *
   * - `'used'` — только ключи, которые сервер отрисовал на этой странице.
   *   Блоки не помечаются загруженными, поэтому клиент всё равно догружает
   *   словарь фоном: режим не может выйти хуже выключенного.
   * - `'full'` — весь словарь текущей локали. Клиент чанк не грузит вовсе, но
   *   словарь дублируется в каждую страницу и перестаёт быть общим кэшируемым
   *   файлом.
   * - `false` — не вмешиваться; middleware не регистрируется.
   */
  ssrStrings?: SSRStringsMode
}

/** Объём снимка строк, который интеграция кладёт в HTML. */
export type SSRStringsMode = 'used' | 'full' | false

export type ResolvedOptions = Required<Omit<GranularityAstroOptions, 'i18n' | 'themeCookie'>> & {
  themeCookie: string | undefined
  i18n: { packages: string[], locales: string[], ssrStrings: SSRStringsMode } | false
}

const DEFAULTS: ResolvedOptions = {
  themeStorageKey: DEFAULT_STORAGE_KEY,
  themeCookie: undefined,
  injectThemeScript: true,
  resolver: true,
  i18n: { packages: [], locales: [], ssrStrings: 'used' },
  strict: true,
}

function resolveI18n(i18n: GranularityAstroOptions['i18n']): ResolvedOptions['i18n'] {
  if (i18n === false)
    return false
  if (i18n !== undefined && (typeof i18n !== 'object' || i18n === null || Array.isArray(i18n)))
    throw new TypeError('[astro-granularity] i18n: ожидался объект настроек или `false`.')

  const ssrStrings = i18n?.ssrStrings ?? 'used'
  if (ssrStrings !== 'used' && ssrStrings !== 'full' && ssrStrings !== false) {
    throw new TypeError(
      `[astro-granularity] i18n.ssrStrings: ожидалось 'used' | 'full' | false, получено ${JSON.stringify(ssrStrings)}.`,
    )
  }

  return {
    packages: [...(i18n?.packages ?? [])],
    locales: [...(i18n?.locales ?? [])],
    ssrStrings,
  }
}

export function resolveOptions(options: GranularityAstroOptions = {}): ResolvedOptions {
  // Режимы и режим по умолчанию задаёт сборка granum, а не интеграция. Из JS
  // без типов `defaultTheme` прошла бы молча и ничего бы не сделала.
  if ('defaultTheme' in options) {
    throw new TypeError(
      '[astro-granularity] defaultTheme больше нет: режимы и режим по умолчанию задаёт тема в granum.config, '
      + 'без сохранённого выбора скрипт следует системной схеме.',
    )
  }

  const themeStorageKey = options.themeStorageKey ?? DEFAULTS.themeStorageKey
  if (typeof themeStorageKey !== 'string' || themeStorageKey.length === 0)
    throw new TypeError('[astro-granularity] themeStorageKey: ожидалась непустая строка.')

  const themeCookie = options.themeCookie
  if (themeCookie !== undefined && (typeof themeCookie !== 'string' || themeCookie.length === 0))
    throw new TypeError('[astro-granularity] themeCookie: ожидалась непустая строка.')

  return {
    themeStorageKey,
    themeCookie,
    injectThemeScript: options.injectThemeScript ?? DEFAULTS.injectThemeScript,
    resolver: options.resolver ?? DEFAULTS.resolver,
    i18n: resolveI18n(options.i18n),
    strict: options.strict ?? DEFAULTS.strict,
  }
}
