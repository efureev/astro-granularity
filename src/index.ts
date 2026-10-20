import type { AstroIntegration } from 'astro'
import { fileURLToPath } from 'node:url'
import { checkEnvironment, collectPluginNames, type EnvProblem, formatProblems, GRANUM_PLUGIN_NAME } from './env-check'
import { createVirtualI18nPlugin } from './i18n-plugin'
import { createVirtualThemePlugin } from './theme-plugin'
import { resolveOptions, type GranularityAstroOptions, type ResolvedOptions } from './options'
import { createThemeScript, findThemeManifest, THEME_SCRIPT_BUDGET_BYTES, themeScriptBytes } from './theme-script'

export type { GranularityAstroOptions, ResolvedOptions, SSRStringsMode } from './options'
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
export { buildThemeModuleSource, createVirtualThemePlugin, VIRTUAL_THEME_ID, type VirtualThemeInput, type VirtualThemePlugin } from './theme-plugin'
export { createThemeScript, THEME_SCRIPT_BUDGET_BYTES, type ThemeScriptOptions } from './theme-script'

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
  // Скрипт режима решается в `setup`, а судить, нормально ли это, можно только
  // в `done`, когда список плагинов полон.
  let themeScriptMissing: 'no-plugin' | 'no-api' | null = null

  return {
    name: '@feugene/astro-granularity',
    hooks: {
      'astro:config:setup': async ({ addMiddleware, config, updateConfig, injectScript, logger }) => {
        if (resolved.injectThemeScript)
          themeScriptMissing = await injectThemeScript(config.vite?.plugins, projectRoot(config.root), resolved, injectScript, logger)

        // Модуль порождается здесь, а не лежит файлом: состав лоадеров зависит
        // от опций, а `\0`-префикс закрывает его от разрешения по файловой системе.
        updateConfig({
          vite: {
            plugins: [
              createVirtualI18nPlugin(resolved.i18n === false
                ? false
                : { ...resolved.i18n, defaultLocale: config.i18n?.defaultLocale ?? 'en' }),
              createVirtualThemePlugin({ storageKey: resolved.themeStorageKey, cookie: resolved.themeCookie }),
            ],
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
        const pluginNames = await collectPluginNames(config.vite?.plugins).catch(() => null)
        const problems = checkEnvironment({ integrationNames: config.integrations.map(i => i.name), pluginNames })
        if (themeScriptMissing === 'no-api')
          problems.push(GRANUM_WITHOUT_THEME_MANIFEST)
        // Плагина не было в `setup`, а к `done` он появился — его добавила
        // интеграция, идущая следом. CSS приедет, а скрипт режима — нет.
        if (themeScriptMissing === 'no-plugin' && pluginNames?.includes(GRANUM_PLUGIN_NAME))
          problems.push(THEME_SCRIPT_SKIPPED)
        reportProblems(problems, resolved.strict, logger)
      },
    },
  }
}

type Logger = { warn: (message: string) => void, error: (message: string) => void }

const GRANUM_WITHOUT_THEME_MANIFEST: EnvProblem = {
  level: 'error',
  code: 'granum-without-theme-manifest',
  message:
    'плагин granum не отдаёт манифест режимов до сборки (`api.themeManifest`) — нужен @feugene/granum 3.2 или новее. '
    + 'Без манифеста скрипт режима не знает пар, и первый кадр мигнёт.',
}

const THEME_SCRIPT_SKIPPED: EnvProblem = {
  level: 'warn',
  code: 'theme-script-skipped',
  message:
    'скрипт режима не вставлен: плагин granum добавлен позже этой интеграции, и на её настройке его ещё не было. '
    + 'Поставьте `granum(granumConfig)` прямо в `vite.plugins` конфига Astro.',
}

/**
 * Скрипт режима в `<head>`. Возвращает причину, по которой его нет, — оценит
 * её `astro:config:done`, когда список плагинов полон.
 */
async function injectThemeScript(
  plugins: unknown,
  root: string,
  resolved: ResolvedOptions,
  injectScript: (stage: 'head-inline', content: string) => void,
  logger: Logger,
): Promise<'no-plugin' | 'no-api' | null> {
  const found = await findThemeManifest(plugins, root)
  if (found.kind !== 'found')
    return found.kind
  // Основная тема без режимов: пару ставить нечем, и скрипт был бы пустой работой.
  const main = found.manifest.themes.find(theme => theme.id === found.manifest.defaultTheme)
  if (!main || main.modes.length === 0)
    return null

  const script = createThemeScript(found.manifest, {
    storageKey: resolved.themeStorageKey,
    ...(resolved.themeCookie !== undefined ? { cookie: resolved.themeCookie } : {}),
  })
  const bytes = themeScriptBytes(script)
  if (bytes > THEME_SCRIPT_BUDGET_BYTES) {
    logger.warn(
      `скрипт режима — ${bytes} Б при бюджете ${THEME_SCRIPT_BUDGET_BYTES} Б (пар в сборке: ${found.manifest.themes.reduce((sum, theme) => sum + theme.modes.length, 0)}). `
      + 'Он блокирует первую отрисовку: каждый режим добавляет к нему свою пару.',
    )
  }
  // `head-inline` — единственная точка, исполняющаяся синхронно до
  // отрисовки. Любая другая даёт кадр в чужом режиме.
  injectScript('head-inline', script)
  return null
}

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
