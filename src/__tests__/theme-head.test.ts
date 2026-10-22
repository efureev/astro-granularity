import { createThemeManifest } from '@feugene/granum/runtime'
import { describe, expect, it } from 'vitest'
import { applyThemeHead, createThemeHead } from '../theme-head'
import { createThemeScript } from '../theme-script'

const modes = [{ name: 'light', colorScheme: 'light' as const }, { name: 'dark', colorScheme: 'dark' as const }]

function manifest(clayHref?: string) {
  return createThemeManifest({
    defaultTheme: 'slate',
    themes: [
      { id: 'slate', title: 'Сланец', defaultMode: 'light', modes },
      { id: 'clay', title: 'Глина', defaultMode: 'light', modes, ...(clayHref ? { href: clayHref } : {}) },
    ],
  })
}

const OPTIONS = { storageKey: 'gr-theme', cookie: 'gr-theme' }
// Скрипт, вставленный на конфигурации: адреса листа «Глины» ещё нет.
const STALE = createThemeScript(manifest(), OPTIONS)
const page = (root: string, head = '') =>
  `<!doctype html><html lang="ru"${root}><head><link rel="stylesheet" href="/_astro/app.css">${head}<script>${STALE}</script></head><body></body></html>`

describe('createThemeHead', () => {
  it('подменять нечего: скрипт не вставлен или у дополнительной темы нет листа', () => {
    expect(createThemeHead(manifest('/_astro/clay.css'), null, OPTIONS)).toBeNull()
    expect(createThemeHead(manifest(), STALE, OPTIONS)).toBeNull()
  })

  it('скрипт по манифесту сборки знает лист дополнительной темы', () => {
    const head = createThemeHead(manifest('/_astro/clay.css'), STALE, OPTIONS)!
    expect(STALE).not.toContain('clay-dark')
    expect(head.fresh).toContain('clay-dark')
    expect(head.fresh).toContain('/_astro/clay.css')
  })
})

describe('applyThemeHead', () => {
  const head = createThemeHead(manifest('/_astro/clay.css'), STALE, OPTIONS)!

  it('подменяет вставленный скрипт на месте — после листов стилей', () => {
    const html = applyThemeHead(page(''), head)
    expect(html).not.toContain(STALE)
    expect(html.indexOf(head.fresh)).toBeGreaterThan(html.indexOf('/_astro/app.css'))
    expect(html).not.toMatch(/<link[^>]*data-granum-theme/)
  })

  it('пара дополнительной темы от сервера — её лист перед скриптом', () => {
    const html = applyThemeHead(page(' data-theme="clay-dark"'), head)
    const link = html.indexOf('<link rel="stylesheet" href="/_astro/clay.css"')
    expect(link).toBeGreaterThan(html.indexOf('/_astro/app.css'))
    expect(link).toBeLessThan(html.indexOf(head.fresh))
    expect(html).toContain('data-granum-theme="clay"')
  })

  it('пара основной темы и уже вставленный лист второго листа не дают', () => {
    expect(applyThemeHead(page(' data-theme="slate-dark"'), head)).not.toMatch(/<link[^>]*data-granum-theme/)
    const withSheet = page(' data-theme="clay-dark"', '<link rel="stylesheet" href="/_astro/clay.css" data-granum-theme="clay">')
    expect(applyThemeHead(withSheet, head).match(/<link[^>]*data-granum-theme="clay"/g)).toHaveLength(1)
  })

  it('чужой HTML и скрипт вне `<head>` не трогает', () => {
    expect(applyThemeHead('<p>фрагмент</p>', head)).toBe('<p>фрагмент</p>')
    const inBody = `<html><head></head><body><script>${STALE}</script></body></html>`
    expect(applyThemeHead(inBody, head)).toBe(inBody)
  })
})
