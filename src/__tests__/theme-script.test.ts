import type { GranumThemeManifest } from '@feugene/granum/runtime'
import { createThemeController } from '@feugene/granum/runtime'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STORAGE_KEY } from '../options'
import { createThemeScript, findThemeManifest, THEME_SCRIPT_BUDGET_BYTES, themeScriptBytes } from '../theme-script'

/** Манифест `virtual:granum/themes` для `themes: [{ theme: 'slate', modes: ['light', 'dark'] }]`. */
const SLATE: GranumThemeManifest = {
  themes: [{
    id: 'slate',
    title: 'Slate',
    modes: [
      { name: 'light', colorScheme: 'light', value: 'slate-light' },
      { name: 'dark', colorScheme: 'dark', value: 'slate-dark' },
    ],
    defaultMode: 'light',
  }],
  defaultTheme: 'slate',
  activation: { attribute: 'data-theme', value: '{theme}-{mode}' },
}

type Env = {
  /** Пара, уже стоящая на корне, — от сервера. */
  pair?: string
  stored?: string | null
  cookie?: string
  prefersDark?: boolean
  storageThrows?: boolean
  noMatchMedia?: boolean
}

function fakeRoot(pair?: string) {
  const attrs = new Map<string, string>(pair === undefined ? [] : [['data-theme', pair]])
  return {
    attrs,
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
  }
}

/**
 * Исполняет скрипт так, как его исполнит браузер: с подставленными
 * `document`, `localStorage` и `matchMedia`. Проверять генератор строкой
 * бессмысленно — важно поведение, а не текст.
 */
function run(script: string, env: Env = {}) {
  const root = fakeRoot(env.pair)
  // Подписка принимается, но никуда не сохраняется: остальным тестам событие
  // не нужно, а её отсутствие роняло бы их все.
  const document = { documentElement: root, cookie: env.cookie ?? '', addEventListener() {} }
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
  const window = { matchMedia }

  // eslint-disable-next-line no-new-func
  new Function('document', 'localStorage', 'matchMedia', 'window', script)(document, localStorage, matchMedia, window)
  return root.attrs.get('data-theme')
}

/** Что выберет контроллер granum — тот, на котором стоит `useTheme` ядра. */
function controllerPair(env: Env): string | undefined {
  const root = fakeRoot(env.pair)
  createThemeController(SLATE, {
    target: root,
    storage: { getItem: () => env.stored ?? null, setItem: () => {} },
    storageKey: DEFAULT_STORAGE_KEY,
    prefersDark: () => Boolean(env.prefersDark),
  })
  return root.attrs.get('data-theme')
}

const PAIRS = [undefined, 'slate-dark', 'slate-light'] as const
const STORED = [null, 'light', 'dark', 'garbage', ''] as const
const SYSTEM = [true, false] as const

const script = (options = {}) => createThemeScript(SLATE, { storageKey: DEFAULT_STORAGE_KEY, ...options })

describe('скрипт режима', () => {
  it('выбирает ту же пару, что контроллер `useTheme`, во всех сочетаниях входов', () => {
    for (const pair of PAIRS) {
      for (const stored of STORED) {
        for (const prefersDark of SYSTEM) {
          const env = { pair, stored, prefersDark }
          expect(run(script(), env), JSON.stringify(env)).toBe(controllerPair(env))
        }
      }
    }
  })

  it('ставит пару из манифеста, а не имя режима', () => {
    expect(run(script(), { stored: 'dark' })).toBe('slate-dark')
  })

  it('пару, пришедшую с сервера, не трогает', () => {
    expect(run(script(), { pair: 'slate-light', stored: 'dark', prefersDark: true })).toBe('slate-light')
  })

  it('переживает бросающий `localStorage` (приватный режим Safari)', () => {
    expect(run(script(), { storageThrows: true, prefersDark: true })).toBe('slate-dark')
  })

  it('без `matchMedia` даёт режим светлой схемы', () => {
    expect(run(script(), { noMatchMedia: true })).toBe('slate-light')
  })

  it('не бросает наружу: исключение в `<head>` останавливает разбор документа', () => {
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function('document', 'localStorage', 'matchMedia', 'window', script())(undefined, undefined, undefined, undefined)
    }).not.toThrow()
  })

  it('уважает нестандартный ключ хранилища', () => {
    const custom = createThemeScript(SLATE, { storageKey: 'admin-theme' })
    expect(custom).toContain('"admin-theme"')
    expect(run(custom, { stored: 'dark' })).toBe('slate-dark')
  })

  it('cookie режима читается раньше `localStorage`', () => {
    const withCookie = script({ cookie: 'gr-theme' })
    expect(run(withCookie, { cookie: 'a=1; gr-theme=dark', stored: 'light' })).toBe('slate-dark')
    expect(run(withCookie, { cookie: 'a=1', stored: 'dark' })).toBe('slate-dark')
    // Без `themeCookie` чужая cookie с тем же именем выбор не перебивает.
    expect(run(script(), { cookie: 'gr-theme=dark', stored: 'light' })).toBe('slate-light')
  })

  it('восстанавливает пару по `astro:after-swap` — иначе она теряется на клиентском переходе', () => {
    const root = fakeRoot()
    const swapListeners: Array<() => void> = []
    const document = {
      documentElement: root,
      cookie: '',
      addEventListener(type: string, fn: () => void) {
        if (type === 'astro:after-swap')
          swapListeners.push(fn)
      },
    }
    const matchMedia = () => ({ matches: false })

    // eslint-disable-next-line no-new-func
    new Function('document', 'localStorage', 'matchMedia', 'window', script())(
      document,
      { getItem: () => 'dark' },
      matchMedia,
      { matchMedia },
    )
    expect(root.attrs.get('data-theme')).toBe('slate-dark')

    // `swapRootAttributes` снимает с `<html>` все атрибуты и копирует их из
    // полученного документа, где пары нет: скрипт на нём не исполнялся.
    root.attrs.clear()
    expect(swapListeners, 'скрипт не подписался на `astro:after-swap`').toHaveLength(1)

    swapListeners.forEach(fn => fn())
    expect(root.attrs.get('data-theme')).toBe('slate-dark')
  })

  it('укладывается в бюджет на теме из двух режимов, и с cookie тоже', () => {
    for (const options of [{}, { cookie: 'gr-theme' }])
      expect(themeScriptBytes(script(options))).toBeLessThanOrEqual(THEME_SCRIPT_BUDGET_BYTES)
  })
})

describe('манифест у плагина granum', () => {
  const plugin = (manifest: GranumThemeManifest) => ({
    name: 'granum:app',
    api: { themeManifest: async (root?: string) => ({ ...manifest, defaultTheme: root ?? '' }) },
  })

  it('берётся из `api.themeManifest` с корнем проекта, в том числе из вложенного списка', async () => {
    const found = await findThemeManifest([{ name: 'vite:vue' }, [Promise.resolve(plugin(SLATE))]], '/app')
    expect(found).toMatchObject({ kind: 'found', manifest: { defaultTheme: '/app' } })
  })

  it('различает «плагина нет» и «плагин без api»', async () => {
    await expect(findThemeManifest([{ name: 'vite:vue' }], '/app')).resolves.toEqual({ kind: 'no-plugin' })
    await expect(findThemeManifest([{ name: 'granum:app' }], '/app')).resolves.toEqual({ kind: 'no-api' })
    await expect(findThemeManifest(undefined, '/app')).resolves.toEqual({ kind: 'no-plugin' })
  })
})

describe('контракт с ядром', () => {
  it('ключ хранилища совпадает с `useTheme` ядра', async () => {
    // Расхождение означает: скрипт прочитает не то, что записал рантайм,
    // и страница мигнёт при каждой загрузке с выбранным режимом.
    const { GR_THEME_STORAGE_KEY } = await import('@feugene/granularity')
    expect(DEFAULT_STORAGE_KEY).toBe(GR_THEME_STORAGE_KEY)
  })
})
