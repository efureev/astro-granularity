/** Имя, под которым `granum()` регистрируется в Vite. */
export const GRANUM_PLUGIN_NAME = 'granum:app'

export const VUE_INTEGRATION_NAME = '@astrojs/vue'

export type EnvProblem = {
  level: 'error' | 'warn'
  code: 'no-vue-integration' | 'no-granum-plugin' | 'duplicate-granum-plugin' | 'granum-plugins-unreadable'
  message: string
}

type PluginLike = { name?: string }

/**
 * `PluginOption` — не плоский список: Vite принимает вложенные массивы, `false`
 * и `null` на месте выключенного плагина и промисы. Плоского перебора мало —
 * `granum()`, приехавший внутри пресета плагинов потребителя, дал бы ложную
 * тревогу.
 */
export async function collectPluginNames(plugins: unknown, seen = new Set<unknown>()): Promise<string[]> {
  const resolved: unknown = await plugins
  if (!Array.isArray(resolved))
    return []

  const names: string[] = []
  for (const item of resolved) {
    const plugin: unknown = await item
    if (plugin === null || typeof plugin !== 'object' || seen.has(plugin))
      continue
    seen.add(plugin)

    if (Array.isArray(plugin)) {
      names.push(...await collectPluginNames(plugin, seen))
      continue
    }
    const { name } = plugin as PluginLike
    if (typeof name === 'string')
      names.push(name)
  }
  return names
}

export type EnvInput = {
  /** Имена интеграций из `config.integrations`. */
  integrationNames: string[]
  /**
   * Имена плагинов Vite. `null` — список развернуть не удалось: это не то же
   * самое, что пустой список, и сообщение обязано быть другим.
   */
  pluginNames: string[] | null
}

export function checkEnvironment({ integrationNames, pluginNames }: EnvInput): EnvProblem[] {
  const problems: EnvProblem[] = []

  if (!integrationNames.includes(VUE_INTEGRATION_NAME)) {
    problems.push({
      level: 'error',
      code: 'no-vue-integration',
      message:
        `не найдена интеграция ${VUE_INTEGRATION_NAME}. Без неё острова с компонентами `
        + 'не отрисуются: Astro не знает, чем рендерить `.vue`.\n'
        + "  Добавьте: integrations: [vue(), granularity()]  // import vue from '@astrojs/vue'",
    })
  }

  if (pluginNames === null) {
    problems.push({
      level: 'warn',
      code: 'granum-plugins-unreadable',
      message:
        'список плагинов Vite развернуть не удалось, поэтому наличие плагина granum не проверено. '
        + 'Если компоненты приедут голыми — причина здесь.',
    })
    return problems
  }

  const granumPlugins = pluginNames.filter(name => name === GRANUM_PLUGIN_NAME).length
  if (granumPlugins === 0) {
    problems.push({
      level: 'error',
      code: 'no-granum-plugin',
      message:
        'в конфиге Vite нет плагина granum. CSS дизайн-системы не приедет ниоткуда: '
        + 'ни утилит, ни токенов, ни тем — компоненты отрисуются голыми.\n'
        + '  Добавьте в astro.config.mjs:\n'
        + "    import { granum } from '@feugene/granum/vite'\n"
        + "    import granumConfig from './granum.config.mjs'\n"
        + '    vite: { plugins: [granum(granumConfig)] }\n'
        + "  И один импорт в лейаут: import 'virtual:granum.css'",
    })
  }
  else if (granumPlugins > 1) {
    problems.push({
      level: 'error',
      code: 'duplicate-granum-plugin',
      message:
        `плагин granum зарегистрирован ${granumPlugins} раза. Каждый инстанс держит свою `
        + 'резолюцию и пишет свой отчёт сборки, а виртуальные модули отдаёт тот, что успел '
        + 'первым, — то есть CSS может приехать не по тому конфигу, который правили.\n'
        + '  Оставьте одну запись `granum(...)` в `vite.plugins`.',
    })
  }

  return problems
}

/**
 * Интеграция не правит чужой конфиг молча: тихо дописанный плагин даёт баги,
 * которые ищут днями — человек читает свой `astro.config.mjs`, видит одно, а
 * собирается другое. Поэтому расхождение только называется, а чинит его автор.
 */
export function formatProblems(problems: EnvProblem[]): string {
  return problems.map(p => `[astro-granularity] ${p.message}`).join('\n\n')
}
