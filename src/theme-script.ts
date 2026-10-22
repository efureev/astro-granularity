import type { GranumThemeManifest } from '@feugene/granum/runtime'
import { createThemeScriptCode } from '@feugene/granum/runtime'
import { collectPlugins, GRANUM_PLUGIN_NAME } from './env-check'

/**
 * Бюджет инлайн-скрипта на теме из двух режимов. Он блокирует отрисовку по
 * определению, поэтому растёт только осознанно: превышение роняет тесты пакета.
 * У потребителя размер растёт с числом режимов сборки — каждый добавляет свою
 * пару, — и там превышение даёт предупреждение, а не падение.
 */
export const THEME_SCRIPT_BUDGET_BYTES = 512

/**
 * Бюджет скрипта сборки с одной дополнительной темой из двух режимов. Только
 * тогда скрипт везёт её пары и загрузчик её листа (`<link blocking="render">`);
 * растёт так же — решением владельца.
 */
export const THEME_SCRIPT_ADDITIONAL_BUDGET_BYTES = 1024

export type ThemeScriptOptions = {
  /** Ключ `localStorage`, где лежит имя режима. */
  storageKey: string
  /** Cookie с именем режима — для SSR с `createCookieStorage`; читается раньше `localStorage`. */
  cookie?: string
}

/**
 * Инлайн-скрипт, ставящий пару режима **до первой отрисовки**.
 *
 * Код целиком от granum: правило выбора то же, что у контроллера, на котором
 * стоит `useTheme` ядра, а пары вписаны из манифеста сборки. Своё у Astro одно —
 * повтор на `astro:after-swap`: `ClientRouter` снимает с `<html>` все атрибуты и
 * копирует их из полученного документа, а там пары нет — скрипт на нём не исполнялся.
 */
export function createThemeScript(manifest: GranumThemeManifest, options: ThemeScriptOptions): string {
  return createThemeScriptCode({
    manifest,
    storageKey: options.storageKey,
    ...(options.cookie !== undefined ? { cookie: options.cookie } : {}),
    reapplyOn: ['astro:after-swap'],
  })
}

export function themeScriptBytes(script: string): number {
  return Buffer.byteLength(script, 'utf8')
}

type GranumAppPlugin = {
  api?: { themeManifest?: (root?: string) => Promise<GranumThemeManifest> }
}

export type ThemeManifestLookup =
  | { kind: 'found', manifest: GranumThemeManifest }
  /** Плагина в списке нет — или его добавит интеграция, идущая следом. */
  | { kind: 'no-plugin' }
  /** granum старше 3.1: манифест до сборки он не отдаёт. */
  | { kind: 'no-api' }

/**
 * Манифест режимов — у плагина granum приложения, из того же конфига, что и CSS.
 * Сам `virtual:granum/themes` здесь недоступен: скрипт вставляется на этапе
 * конфигурации Astro, раньше, чем Vite начнёт сборку.
 */
export async function findThemeManifest(plugins: unknown, root: string): Promise<ThemeManifestLookup> {
  const plugin = (await collectPlugins(plugins)).find(p => p.name === GRANUM_PLUGIN_NAME) as GranumAppPlugin | undefined
  if (!plugin)
    return { kind: 'no-plugin' }
  if (typeof plugin.api?.themeManifest !== 'function')
    return { kind: 'no-api' }
  return { kind: 'found', manifest: await plugin.api.themeManifest(root) }
}
