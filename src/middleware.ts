/// <reference path="../client.d.ts" />
/// <reference types="@feugene/granum/client" />
import { defaultLocale, locales } from 'virtual:granularity/i18n'
import { cookie, headScript, storageKey } from 'virtual:granularity/theme'
import manifest from 'virtual:granum/themes'
import { createGranularitySSRMiddleware } from './ssr-middleware'
import { createThemeHead } from './theme-head'

/**
 * Точка входа для `addMiddleware` — регистрируется интеграцией, приложению
 * подключать её руками не нужно.
 */
export const onRequest = createGranularitySSRMiddleware({
  defaultLocale,
  locales,
  themeHead: createThemeHead(manifest, headScript, { storageKey, ...(cookie !== null ? { cookie } : {}) }),
})
