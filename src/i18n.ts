export const VIRTUAL_I18N_ID = 'virtual:granularity/i18n'

/** Подпуть, из которого порождённый модуль берёт вывод блоков. */
const RUNTIME_SPECIFIER = '@feugene/astro-granularity/runtime'

export type I18nModuleInput = {
  /** Пакеты помимо ядра. Ядро подключается всегда. */
  packages: string[]
  /** Локали. Пусто — берётся агрегат `/i18n/all` со всеми, что есть в пакете. */
  locales: string[]
  /** Язык, когда `<html lang>` не прочитался. Берётся из `config.i18n` Astro. */
  defaultLocale: string
}

const IDENTIFIER = /^[a-z][\w$]*$/i

/**
 * Имя npm-пакета: скоуп необязателен, подпутей нет.
 *
 * Строже, чем допускает npm, и намеренно: сюда приходят только спецификаторы,
 * к которым генератор сам допишет `/i18n`.
 */
const PACKAGE_SPECIFIER = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i

/**
 * Спецификатор уезжает в исходник модуля, поэтому проверяется до подстановки:
 * `packages: ["x'; globalThis.evil()//"]` иначе стал бы исполняемым кодом в
 * чужой сборке. Второй слой — эмиссия через `JSON.stringify`, а не в кавычках.
 */
export function assertPackageSpecifier(name: string): void {
  if (typeof name !== 'string' || !PACKAGE_SPECIFIER.test(name) || name.length > 214) {
    throw new TypeError(
      `[astro-granularity] «${name}» не годится как имя пакета. `
      + 'Ожидалось `pkg` или `@scope/pkg` — без подпутей, путей и URL.',
    )
  }
}

/**
 * Локаль уезжает в исходник модуля как имя импорта, поэтому проверяется до
 * подстановки: `locales: ['en; globalThis.x=1']` иначе стал бы исполняемым кодом.
 */
function assertLocaleName(locale: string): void {
  if (!IDENTIFIER.test(locale)) {
    throw new TypeError(
      `[astro-granularity] локаль «${locale}» не годится как имя импорта. `
      + 'Ожидалось имя вида `en`, `ru`, `zhHans`.',
    )
  }
}

/**
 * Исходник виртуального модуля с лоадерами строк.
 *
 * Порождается, а не лежит файлом, потому что состав зависит от опций: при явных
 * локалях импортируются именованные экспорты (`{ en, ru }`), и неиспользуемые
 * языки отсекаются сборкой. Агрегат `/i18n/all` тянет все, включая `es`, —
 * порталу это лишние килобайты на каждом острове.
 */
export function buildI18nModuleSource({ packages, locales, defaultLocale }: I18nModuleInput): string {
  const specifiers = ['@feugene/granularity', ...packages.filter(p => p !== '@feugene/granularity')]
  for (const name of specifiers)
    assertPackageSpecifier(name)
  for (const locale of locales)
    assertLocaleName(locale)
  assertLocaleName(defaultLocale)

  const lines: string[] = [
    '// Порождено @feugene/astro-granularity. Правки здесь не сохраняются.',
    `import { deriveI18nBlocks } from ${JSON.stringify(RUNTIME_SPECIFIER)}`,
  ]
  const loaderNames: string[] = []

  specifiers.forEach((specifier, index) => {
    if (locales.length === 0) {
      const all = `all${index}`
      loaderNames.push(all)
      lines.push(`import ${all} from ${JSON.stringify(`${specifier}/i18n/all`)}`)
      return
    }

    const named = locales.map(locale => `${locale} as ${locale}${index}`).join(', ')
    loaderNames.push(...locales.map(locale => `${locale}${index}`))
    lines.push(`import { ${named} } from ${JSON.stringify(`${specifier}/i18n`)}`)
  })

  lines.push('')
  // `.flat()`, а не спред: подпуть `/i18n/all` отдаёт МАССИВ коллекций, а
  // именованный экспорт — одну коллекцию. Спред объекта бросил бы `TypeError`.
  lines.push(`export const loaders = [${loaderNames.join(', ')}].flat()`)
  // Имена блоков выводятся из самих лоадеров: они лежат вторым уровнем ключа
  // коллекции, поэтому реестра «пакет → имя константы» держать не нужно.
  lines.push('export const blocks = deriveI18nBlocks(loaders)')
  lines.push(`export const defaultLocale = ${JSON.stringify(defaultLocale)}`)

  return `${lines.join('\n')}\n`
}
