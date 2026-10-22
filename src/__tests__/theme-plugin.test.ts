import { describe, expect, it } from 'vitest'
import { buildThemeModuleSource, createVirtualThemePlugin, VIRTUAL_THEME_ID } from '../theme-plugin'

describe('виртуальный модуль режима', () => {
  it('отвечает только на свой id и отдаёт ключ и cookie из опций', () => {
    const plugin = createVirtualThemePlugin({ storageKey: 'gr-theme', cookie: 'gr-theme' })
    expect(plugin.resolveId('virtual:granularity/i18n')).toBeNull()
    const resolved = plugin.resolveId(VIRTUAL_THEME_ID)!
    expect(plugin.load(resolved)).toBe('export const storageKey = "gr-theme"\nexport const cookie = "gr-theme"\nexport const headScript = null\n')
    expect(plugin.load(VIRTUAL_THEME_ID)).toBeNull()
  })

  it('текст вставленного скрипта — для подмены в middleware', () => {
    expect(buildThemeModuleSource({ storageKey: 'k', cookie: undefined, headScript: '(function(){})()' }))
      .toContain('export const headScript = "(function(){})()"')
  })

  it('без cookie — null, а не строка "undefined"', () => {
    expect(buildThemeModuleSource({ storageKey: 'k', cookie: undefined })).toContain('export const cookie = null')
  })
})
