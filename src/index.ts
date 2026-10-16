import type { AstroIntegration } from 'astro'
import { fileURLToPath } from 'node:url'
import { checkEnvironment, collectPluginNames, formatProblems, type EnvProblem } from './env-check'
import { createVirtualI18nPlugin } from './i18n-plugin'
import { resolveOptions, type GranularityAstroOptions } from './options'
import { assertThemeScriptBudget, createThemeScript } from './theme-script'

export type { DefaultTheme, GranularityAstroOptions, ResolvedOptions, SSRStringsMode, ThemeName } from './options'
export { GRANUM_PLUGIN_NAME, VUE_INTEGRATION_NAME } from './env-check'
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
 * Пакеты, чьи серверные входы обязаны быть встроены в бандл — в обоих серверных
 * окружениях Vite: `ssr` (dev-сервер, сборка под адаптером) и `prerender` (статика).
 *
 * `@astrojs/vue` попал сюда не за компанию: его `dist/server.js` первой же
 * строкой делает `import { setup } from 'virtual:astro:vue-app'`, а входная
 * точка пререндера импортирует его голым спецификатором. Это его собственный
 * дефект упаковки, но чинить приходится здесь — иначе любой `.vue`-остров
 * роняет статическую сборку, и потребитель ищет причину сам. Сама интеграция —
 * по той же причине: `app.js` и `middleware.js` импортируют виртуальные модули.
 *
 * Семейства `@feugene/granularity*` здесь нет: его `dist` импортирует только
 * `vue`, `@floating-ui/dom` и свои же подпути, без `.css` и без granum, и Node
 * грузит его как есть — и в сборке, и в `astro dev`.
 */
const NO_EXTERNAL = ['@feugene/astro-granularity', '@astrojs/vue']

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

        // Модуль порождается здесь, а не лежит файлом: состав лоадеров зависит
        // от опций, а `\0`-префикс закрывает его от разрешения по файловой системе.
        updateConfig({
          vite: {
            plugins: [createVirtualI18nPlugin(resolved.i18n === false
              ? false
              : { ...resolved.i18n, defaultLocale: config.i18n?.defaultLocale ?? 'en' })],
            // Оба серверных окружения Vite, а не наследуемый `ssr.noExternal`:
            // Astro 6 перевёл сборку на Environments API. `ssr` — это dev-сервер и
            // сборка под адаптером (`output: 'server'`), `prerender` — статика.
            // Одного `prerender` не хватало: `astro dev` шёл через `ssr`, и первый
            // же компонент с CSS в чанке ронял страницу тем же `ERR_UNKNOWN_FILE_EXTENSION`.
            environments: {
              ssr: { resolve: { noExternal: NO_EXTERNAL } },
              prerender: { resolve: { noExternal: NO_EXTERNAL } },
            },
          },
        })

        if (resolved.i18n !== false && resolved.i18n.ssrStrings !== false)
          registerSSRStrings(addMiddleware)

        if (resolved.resolver) {
          const plugin = await loadResolverPlugin(projectRoot(config.root), logger)
          if (plugin)
            updateConfig({ vite: { plugins: [plugin] } })
        }

      },

      /*
       * Проверка окружения живёт здесь, а не в `astro:config:setup`, потому что
       * читает `config.vite.plugins`, а список полон только после того, как
       * отработали ВСЕ интеграции. В `setup` конфиг соседа, идущего следом, ещё
       * не влит — проверка ругалась бы на исправный проект в зависимости от
       * порядка интеграций. Побочная польза: `@astrojs/vue`, добавленный другой
       * интеграцией, тоже виден.
       */
      'astro:config:done': async ({ config, logger }) => {
        const problems = checkEnvironment({
          integrationNames: config.integrations.map(i => i.name),
          pluginNames: await collectPluginNames(config.vite?.plugins).catch(() => null),
        })
        reportProblems(problems, resolved.strict, logger)
      },
    },
  }
}

type Logger = { warn: (message: string) => void, error: (message: string) => void }

function projectRoot(root: URL | string): string {
  return typeof root === 'string' ? root : fileURLToPath(root)
}

/**
 * Middleware, кладущий строки в HTML.
 *
 * Это единственный канал Astro, который исполняется **на каждую страницу** и
 * при этом знает её маршрут: `injectScript` принимает строку, фиксируемую один
 * раз на сборку, а точка входа `@astrojs/vue` получает только `app`. Без него
 * локаль страницы узнать нечем, и `/ru/` рендерится английским.
 *
 * Оговорок про `output` и `build.concurrency` здесь больше нет. Состояние
 * страницы живёт в `AsyncLocalStorage` (`src/ssr-store.ts`), у каждого запроса
 * свой контекст — параллельная обработка ему безразлична. Раньше состояние было
 * модульным, и фича выключалась везде, где страницы могли рендериться
 * одновременно: под адаптером и при `build.concurrency > 1`.
 */
function registerSSRStrings(
  addMiddleware: (mid: { order: 'pre' | 'post', entrypoint: string }) => void,
): void {
  addMiddleware({ order: 'pre', entrypoint: '@feugene/astro-granularity/middleware' })
}

/**
 * Тип плагина — `any` осознанно. В дереве два независимых экземпляра типов
 * vite: свой у astro и свой у `unplugin-vue-components`. Структурно плагин один
 * и тот же, расходятся только сигнатуры хуков, и свести их можно лишь
 * приведением. Граница узкая: значение уходит прямо в `updateConfig`.
 */
// eslint-disable-next-line ts/no-explicit-any
async function loadResolverPlugin(root: string, logger: Logger): Promise<any> {
  try {
    const [{ default: Components }, { GranularityResolver }] = await Promise.all([
      import('unplugin-vue-components/vite'),
      import('@feugene/unplugin-granularity'),
    ])
    // Резолвер находит пакеты экосистемы в `package.json` проекта и их
    // компоненты — в `exports`. Без `root` он читал бы `process.cwd()`, а
    // `astro build --root <проект>` запускается откуда угодно.
    return Components({ resolvers: GranularityResolver({ root }), dts: false })
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
