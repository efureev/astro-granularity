/// <reference path="../client.d.ts" />
import { defaultLocale, locales } from 'virtual:granularity/i18n'
import { createGranularitySSRMiddleware } from './ssr-middleware'

/**
 * Точка входа для `addMiddleware` — регистрируется интеграцией, приложению
 * подключать её руками не нужно.
 */
export const onRequest = createGranularitySSRMiddleware({ defaultLocale, locales })
