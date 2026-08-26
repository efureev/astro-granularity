/** Имя, под которым `presetGranularNode` регистрируется в UnoCSS. */
export const GRANULAR_PRESET_NAME = 'granular-preset'

export const VUE_INTEGRATION_NAME = '@astrojs/vue'

export type EnvProblem = {
  level: 'error' | 'warn'
  code: 'no-vue-integration' | 'no-uno-preset' | 'uno-config-unreadable'
  message: string
}

type PresetLike = { name?: string, presets?: unknown }

/**
 * Пресеты UnoCSS вкладываются друг в друга, поэтому плоского перебора мало:
 * `presetGranularNode` может приехать внутри составного пресета потребителя, и
 * тогда проверка на верхнем уровне даст ложную тревогу.
 */
export function collectPresetNames(presets: unknown, seen = new Set<unknown>()): string[] {
  if (!Array.isArray(presets))
    return []

  const names: string[] = []
  for (const preset of presets) {
    if (preset === null || typeof preset !== 'object' || seen.has(preset))
      continue
    seen.add(preset)

    const { name, presets: nested } = preset as PresetLike
    if (typeof name === 'string')
      names.push(name)
    names.push(...collectPresetNames(nested, seen))
  }
  return names
}

export type EnvInput = {
  /** Имена интеграций из `config.integrations`. */
  integrationNames: string[]
  /**
   * Имена пресетов UnoCSS. `null` — конфиг прочитать не удалось: это не то же
   * самое, что пустой список, и сообщение обязано быть другим.
   */
  presetNames: string[] | null
}

export function checkEnvironment({ integrationNames, presetNames }: EnvInput): EnvProblem[] {
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

  if (presetNames === null) {
    problems.push({
      level: 'warn',
      code: 'uno-config-unreadable',
      message:
        'конфиг UnoCSS прочитать не удалось, поэтому наличие `presetGranularNode` не проверено. '
        + 'Если компоненты приедут бесцветными — причина здесь.',
    })
  }
  else if (!presetNames.includes(GRANULAR_PRESET_NAME)) {
    problems.push({
      level: 'error',
      code: 'no-uno-preset',
      message:
        `в конфиге UnoCSS нет пресета «${GRANULAR_PRESET_NAME}». Классы из SFC библиотеки не попадут `
        + 'в вывод, и компоненты отрисуются без цвета, отступов и размеров.\n'
        + "  Добавьте в uno.config.ts: presets: [presetGranularNode({ providers: [...] })]"
        + "  // import { presetGranularNode } from '@feugene/unocss-preset-granular/node'",
    })
  }

  return problems
}

/**
 * Интеграция не правит чужой конфиг молча: тихая подстановка пресета даёт баги,
 * которые ищут днями — человек читает свой `uno.config.ts`, видит одно, а
 * собирается другое. Поэтому расхождение только называется, а чинит его автор.
 */
export function formatProblems(problems: EnvProblem[]): string {
  return problems.map(p => `[astro-granularity] ${p.message}`).join('\n\n')
}
