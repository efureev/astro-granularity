/// <reference path="../client.d.ts" />
/// <reference types="@feugene/granum/client" />
import { cookie, headScript, storageKey } from 'virtual:granularity/theme'
import manifest from 'virtual:granum/themes'
import { createThemeHeadMiddleware } from './ssr-middleware'
import { createThemeHead } from './theme-head'

const themeHead = createThemeHead(manifest, headScript, { storageKey, ...(cookie !== null ? { cookie } : {}) })

/**
 * Точка входа для `addMiddleware` у приложения без снимка строк: интеграция
 * регистрирует её, только когда у сборки есть дополнительные темы.
 */
export const onRequest = themeHead
  ? createThemeHeadMiddleware(themeHead)
  : (_context: unknown, next: () => Promise<Response>) => next()
