import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'

/**
 * Точка входа `./app` отдаёт `useTheme()` островов манифест сборки, а не
 * запасной `slate` ядра. Манифест-заглушка — тема `brand` с режимом `ocean`:
 * ни того, ни другого в запасном манифесте нет.
 *
 * Ядро и точка входа решают «сервер или браузер» при загрузке модуля, поэтому
 * окружение выставляется до импорта, а модули грузятся заново на каждый тест.
 */
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function browser() {
  const attributes = new Map<string, string>()
  const stored = new Map<string, string>()
  const root = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
  }
  // Снимка строк в `<head>` нет — точка входа берёт язык страницы.
  vi.stubGlobal('document', { documentElement: { ...root, lang: 'en' }, cookie: '', querySelector: () => null })
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v) },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
  })
  return { attributes, stored }
}

describe('режим островов', () => {
  it('в браузере — модульное состояние по манифесту сборки и ключу опции, одно на все острова', async () => {
    const { attributes, stored } = browser()
    const { default: setup } = await import('../app')
    const { useTheme } = await import('@feugene/granularity/composables/useTheme')

    await setup(createApp({}))
    await setup(createApp({}))

    const theme = useTheme()
    expect(theme.theme.value).toBe('brand')
    expect(theme.modes.map(mode => mode.name)).toEqual(['light', 'ocean'])
    theme.setMode('ocean')
    expect(attributes.get('data-theme')).toBe('brand-ocean')
    expect(stored.get('brand-mode')).toBe('ocean')
  })

  it('на сервере — состояние острова по тому же манифесту, без записи', async () => {
    const { default: setup } = await import('../app')
    const { useTheme } = await import('@feugene/granularity/composables/useTheme')

    const app = createApp({})
    await setup(app)
    const theme = app.runWithContext(() => useTheme())
    expect(theme.theme.value).toBe('brand')
    expect(theme.mode.value).toBe('light')
    expect(theme.modes.map(mode => mode.value)).toEqual(['brand-light', 'brand-ocean'])
  })
})
