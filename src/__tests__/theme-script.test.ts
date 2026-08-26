import { describe, expect, it } from 'vitest'
import { DEFAULT_STORAGE_KEY, type DefaultTheme } from '../options'
import {
  assertThemeScriptBudget,
  createThemeScript,
  resolveTheme,
  THEME_SCRIPT_BUDGET_BYTES,
} from '../theme-script'

type Env = {
  stored?: string | null
  prefersDark?: boolean
  storageThrows?: boolean
  noMatchMedia?: boolean
}

/**
 * Исполняет скрипт так, как его исполнит браузер: с подставленными
 * `document`, `localStorage` и `matchMedia`. Проверять генератор строкой
 * бессмысленно — важно поведение, а не текст.
 */
function run(script: string, env: Env = {}) {
  const root = { dataset: {} as Record<string, unknown>, style: {} as Record<string, unknown> }
  const document = { documentElement: root }
  const localStorage = {
    getItem(_key: string) {
      if (env.storageThrows)
        throw new Error('SecurityError: private mode')
      return env.stored ?? null
    },
  }
  const matchMedia = env.noMatchMedia
    ? undefined
    : (query: string) => ({ matches: query.includes('dark') ? Boolean(env.prefersDark) : false })

  // eslint-disable-next-line no-new-func
  new Function('document', 'localStorage', 'matchMedia', script)(document, localStorage, matchMedia)
  return root
}

const STORED = [null, 'light', 'dark', 'garbage', ''] as const
const SYSTEM = [true, false] as const
const DEFAULTS: DefaultTheme[] = ['system', 'light', 'dark']

describe('скрипт темы', () => {
  it('совпадает с `resolveTheme` во всех сочетаниях входов', () => {
    for (const defaultTheme of DEFAULTS) {
      for (const stored of STORED) {
        for (const prefersDark of SYSTEM) {
          const script = createThemeScript(DEFAULT_STORAGE_KEY, defaultTheme)
          const root = run(script, { stored, prefersDark })
          expect(
            root.dataset.theme,
            `defaultTheme=${defaultTheme} stored=${JSON.stringify(stored)} prefersDark=${prefersDark}`,
          ).toBe(resolveTheme(stored, prefersDark, defaultTheme))
        }
      }
    }
  })

  it('ставит `color-scheme` рядом с `data-theme` — иначе нативные контролы останутся светлыми', () => {
    const root = run(createThemeScript(DEFAULT_STORAGE_KEY, 'dark'))
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('переживает бросающий `localStorage` (приватный режим Safari)', () => {
    const script = createThemeScript(DEFAULT_STORAGE_KEY, 'system')
    const root = run(script, { storageThrows: true, prefersDark: true })
    expect(root.dataset.theme).toBe('dark')
  })

  it('без `matchMedia` даёт светлую тему, а не строку "undefined"', () => {
    const root = run(createThemeScript(DEFAULT_STORAGE_KEY, 'system'), { noMatchMedia: true })
    expect(root.dataset.theme).toBe('light')
  })

  it('не бросает наружу: исключение в `<head>` останавливает разбор документа', () => {
    const script = createThemeScript(DEFAULT_STORAGE_KEY, 'system')
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function('document', 'localStorage', 'matchMedia', script)(undefined, undefined, undefined)
    }).not.toThrow()
  })

  it('уважает нестандартный ключ хранилища', () => {
    const script = createThemeScript('admin-theme', 'system')
    expect(script).toContain('"admin-theme"')
    expect(run(script, { stored: 'dark' }).dataset.theme).toBe('dark')
  })

  it('укладывается в бюджет', () => {
    for (const defaultTheme of DEFAULTS) {
      const script = createThemeScript(DEFAULT_STORAGE_KEY, defaultTheme)
      expect(Buffer.byteLength(script, 'utf8')).toBeLessThanOrEqual(THEME_SCRIPT_BUDGET_BYTES)
      expect(() => assertThemeScriptBudget(script)).not.toThrow()
    }
  })

  it('бюджет — падающий гейт, а не пожелание', () => {
    expect(() => assertThemeScriptBudget('x'.repeat(THEME_SCRIPT_BUDGET_BYTES + 1))).toThrow(/бюджете/)
  })
})

describe('контракт с ядром', () => {
  it('ключ хранилища совпадает с `useTheme` ядра', () => {
    // Расхождение означает: скрипт прочитает не то, что записал рантайм,
    // и страница мигнёт при каждой загрузке с выбранной темой.
    expect(DEFAULT_STORAGE_KEY).toBe('gr-theme')
  })

  it('пишет в `data-theme`, как `applyTheme` ядра', () => {
    const root = run(createThemeScript(DEFAULT_STORAGE_KEY, 'dark'))
    expect(Object.keys(root.dataset)).toEqual(['theme'])
  })
})
