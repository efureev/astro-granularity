import type { AstroIntegration } from 'astro'
import { checkEnvironment, collectPresetNames, formatProblems, type EnvProblem } from './env-check'
import { createVirtualI18nPlugin } from './i18n-plugin'
import { resolveOptions, type GranularityAstroOptions } from './options'
import { assertThemeScriptBudget, createThemeScript } from './theme-script'

export type { DefaultTheme, GranularityAstroOptions, ResolvedOptions, SSRStringsMode, ThemeName } from './options'
export { GRANULAR_PRESET_NAME, VUE_INTEGRATION_NAME } from './env-check'
export { assertPackageSpecifier, buildI18nModuleSource, VIRTUAL_I18N_ID } from './i18n'
export { createVirtualI18nPlugin, type VirtualI18nInput, type VirtualI18nPlugin } from './i18n-plugin'
export { deriveI18nBlocks, type GranularityI18nAdapterLike, type GranularityLocaleLoaders,
  provideGranularityI18n, type ProvideI18nOptions, readPageLocale } from './runtime'
// Шов снимка строк из главного входа не экспортируется намеренно. `ssr.ts`
// держит состояние страницы модульной переменной, а `dist/index.js` исполняется
// в процессе конфига Astro — не в бандле пререндера, где живут `app.js` и
// `middleware.js`. Реестры модулей у них разные, значит и экземпляры состояния
// тоже: `readServerPageLocale()`, взятый отсюда, всегда возвращал бы `null`.
// Приложению шов доступен там, где он работает, — в `./runtime`.
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
      'astro:config:setup': async ({ addMiddleware, config, updateConfig, injectScript, logger }) => {
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

        if (resolved.i18n !== false && resolved.i18n.ssrStrings !== false)
          registerSSRStrings(addMiddleware, config.build?.concurrency ?? 1, config.output, logger)

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
 * Middleware, кладущий строки в HTML.
 *
 * Это единственный канал Astro, который исполняется **на каждую страницу** и
 * при этом знает её маршрут: `injectScript` принимает строку, фиксируемую один
 * раз на сборку, а точка входа `@astrojs/vue` получает только `app`. Без него
 * локаль страницы на сборке узнать нечем, и `/ru/` рендерится английским.
 *
 * Состояние страницы хранится модульной переменной, а параллельная генерация
 * перемешала бы страницы между собой. Молча отдавать при этом чужие строки
 * нельзя, поэтому фича гасится — с объяснением и готовой починкой.
 */
function registerSSRStrings(
  addMiddleware: (mid: { order: 'pre' | 'post', entrypoint: string }) => void,
  concurrency: number,
  output: string | undefined,
  logger: Logger,
): void {
  // Под адаптером запросы идут параллельно в одном процессе, а состояние
  // страницы — модульная переменная: `beginPage` одного запроса затёр бы
  // состояние другого, и страница получила бы чужой язык. Сборочная
  // параллельность ниже — та же беда, только на сборке.
  //
  // Часть страниц под `output: 'server'` может быть пререндерена, и для них
  // снимок был бы безопасен. Отличить их в `astro:config:setup` нечем, поэтому
  // выбирается безопасное поведение, а не выборочное.
  if (output === 'server') {
    logger.warn(
      'строки в HTML выключены: при `output: \'server\'` запросы обрабатываются параллельно '
      + 'в одном процессе, и язык одного запроса попал бы в ответ другого.\n'
      + '  Починка: `i18n: { ssrStrings: false }` — предупреждение уйдёт, строки останутся '
      + 'клиентской догрузкой.',
    )
    return
  }

  if (concurrency > 1) {
    logger.warn(
      'строки в HTML выключены: `build.concurrency` больше единицы, и страницы генерируются '
      + 'параллельно — язык одной попал бы в разметку другой.\n'
      + '  Починка: `build: { concurrency: 1 }` в `astro.config`, либо `i18n: { ssrStrings: false }`, '
      + 'чтобы убрать предупреждение и оставить клиентскую догрузку.',
    )
    return
  }

  addMiddleware({ order: 'pre', entrypoint: '@feugene/astro-granularity/middleware' })
}

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
