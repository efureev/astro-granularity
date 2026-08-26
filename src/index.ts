import type { AstroIntegration } from 'astro'
import { checkEnvironment, collectPresetNames, formatProblems, type EnvProblem } from './env-check'
import { createVirtualI18nPlugin } from './i18n-plugin'
import { resolveOptions, type GranularityAstroOptions } from './options'
import { assertThemeScriptBudget, createThemeScript } from './theme-script'

export type { DefaultTheme, GranularityAstroOptions, ResolvedOptions, ThemeName } from './options'
export { GRANULAR_PRESET_NAME, VUE_INTEGRATION_NAME } from './env-check'
export { assertPackageSpecifier, buildI18nModuleSource, VIRTUAL_I18N_ID } from './i18n'
export { createVirtualI18nPlugin, type VirtualI18nInput, type VirtualI18nPlugin } from './i18n-plugin'
export { deriveI18nBlocks, type GranularityI18nAdapterLike, type GranularityLocaleLoaders,
  provideGranularityI18n, type ProvideI18nOptions, readPageLocale } from './runtime'
export { createThemeScript, resolveTheme, THEME_SCRIPT_BUDGET_BYTES } from './theme-script'

/**
 * Читает конфиг UnoCSS, чтобы убедиться в наличии granular-пресета.
 *
 * `null` вместо пустого списка, когда конфига нет или он не читается: «пресета
 * нет» и «проверить не смогли» — разные новости, и сообщения у них разные.
 */
async function loadPresetNames(root: string | URL): Promise<string[] | null> {
  try {
    const { loadConfig } = await import('@unocss/config')
    const { config } = await loadConfig(typeof root === 'string' ? root : root.pathname)
    if (!config)
      return null
    return collectPresetNames(config.presets)
  }
  catch {
    return null
  }
}

/**
 * Пакеты, чьи серверные входы обязаны быть встроены в бандл.
 *
 * `@astrojs/vue` попал сюда не за компанию: его `dist/server.js` первой же
 * строкой делает `import { setup } from 'virtual:astro:vue-app'`, а входная
 * точка пререндера импортирует его голым спецификатором. Это его собственный
 * дефект упаковки, но чинить приходится здесь — иначе любой `.vue`-остров
 * роняет статическую сборку, и потребитель ищет причину сам.
 *
 * Семейство `@feugene/granularity*` — по другой причине и не менее обязательно.
 * Часть компонентов несёт в собранном чанке статический `import '../styles.css'`
 * (в ядре 0.35.0 таких 19 из 78, включая `GrIcon`, `GrSelect`, `GrToaster`).
 * Оставшись внешним, такой модуль грузится Node, а тот падает
 * `ERR_UNKNOWN_FILE_EXTENSION` на `.css`. `GrButton` в этот список не входит —
 * поэтому дефект не виден, пока остров не заденет один из тех девятнадцати.
 */
const NO_EXTERNAL = ['@feugene/astro-granularity', '@astrojs/vue', /^@feugene\/granularity/]

export default function granularity(options: GranularityAstroOptions = {}): AstroIntegration {
  const resolved = resolveOptions(options)

  return {
    name: '@feugene/astro-granularity',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectScript, logger }) => {
        if (resolved.injectThemeScript) {
          const script = createThemeScript(resolved.themeStorageKey, resolved.defaultTheme)
          assertThemeScriptBudget(script)
          // `head-inline` — единственная точка, исполняющаяся синхронно до
          // отрисовки. Любая другая даёт кадр в чужой теме.
          injectScript('head-inline', script)
        }

        if (resolved.injectStyleBundle)
          injectScript('page-ssr', "import '@feugene/granularity/styles.css'")

        // Модуль порождается здесь, а не лежит файлом: состав лоадеров зависит
        // от опций, а `\0`-префикс закрывает его от разрешения по файловой системе.
        updateConfig({
          vite: {
            plugins: [createVirtualI18nPlugin(resolved.i18n === false
              ? false
              : { ...resolved.i18n, defaultLocale: config.i18n?.defaultLocale ?? 'en' })],
            // Пререндер — собственное окружение vite: Astro 6 перевёл сборку на
            // Environments API, и наследие `ssr.noExternal` его не покрывает.
            environments: {
              prerender: { resolve: { noExternal: NO_EXTERNAL } },
            },
          },
        })

        if (resolved.resolver) {
          const plugin = await loadResolverPlugin(logger)
          if (plugin)
            updateConfig({ vite: { plugins: [plugin] } })
        }

        const problems = checkEnvironment({
          integrationNames: config.integrations.map(i => i.name),
          presetNames: await loadPresetNames(config.root),
        })
        reportProblems(problems, resolved.strict, logger)
      },

    },
  }
}

type Logger = { warn: (message: string) => void, error: (message: string) => void }

/**
 * Тип плагина — `any` осознанно. В дереве два независимых экземпляра типов
 * vite: свой у astro и свой у `unplugin-vue-components`. Структурно плагин один
 * и тот же, расходятся только сигнатуры хуков, и свести их можно лишь
 * приведением. Граница узкая: значение уходит прямо в `updateConfig`.
 */
// eslint-disable-next-line ts/no-explicit-any
async function loadResolverPlugin(logger: Logger): Promise<any> {
  try {
    const [{ default: Components }, { GranularityResolver }] = await Promise.all([
      import('unplugin-vue-components/vite'),
      import('@feugene/unplugin-granularity'),
    ])
    return Components({ resolvers: [GranularityResolver()], dts: false })
  }
  catch {
    logger.warn(
      'резолвер авто-импорта пропущен: нет `unplugin-vue-components` или `@feugene/unplugin-granularity`. '
      + 'Импорты компонентов в `.vue` придётся писать вручную. В `.astro` они и так явные.',
    )
    return null
  }
}

function reportProblems(problems: EnvProblem[], strict: boolean, logger: Logger): void {
  if (problems.length === 0)
    return

  const errors = problems.filter(p => p.level === 'error')
  const warnings = problems.filter(p => p.level === 'warn')

  for (const w of warnings)
    logger.warn(w.message)

  if (errors.length === 0)
    return

  const text = formatProblems(errors)
  if (!strict) {
    logger.error(text)
    return
  }
  // Сборка падает здесь, а не отдаёт бесцветную страницу: молчаливо
  // сломанная тема обнаруживается в проде, а упавшая сборка — сразу.
  throw new Error(text)
}
