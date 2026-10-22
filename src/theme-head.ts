import type { GranumThemeManifest } from '@feugene/granum/runtime'
import type { ThemeScriptOptions } from './theme-script'
import { isSelectableTheme, resolveThemeActivation, THEME_SHEET_ATTRIBUTE, themeSheetLink } from '@feugene/granum/runtime'
import { createThemeScript } from './theme-script'

/**
 * Скрипт режима по манифесту сборки — для страниц с дополнительными темами.
 *
 * Интеграция вставляет скрипт на конфигурации Astro, раньше сборки: адресов
 * листов дополнительных тем тогда ещё нет, и скрипт знает только пары основной.
 * Такой скрипт дополнительную тему не выбирает, а её пару, которую уже поставил
 * сервер, принимает за чужую и перебивает. На рендере страницы манифест сборки
 * с адресами уже есть, и middleware подменяет текст скрипта собранным по нему.
 * Место в `<head>` остаётся прежним — после листов стилей: лист дополнительной
 * темы обязан стоять в каскаде после основного, иначе тот его перебьёт.
 */
export type ThemeHead = {
  manifest: GranumThemeManifest
  /** Текст, вставленный на конфигурации. */
  stale: string
  /** Тот же скрипт по манифесту сборки. */
  fresh: string
}

/**
 * `null`, когда подменять нечего: скрипт не вставлен или у сборки нет
 * дополнительной темы с листом — тогда вставленный скрипт и так полон.
 */
export function createThemeHead(manifest: GranumThemeManifest, headScript: string | null, options: ThemeScriptOptions): ThemeHead | null {
  if (headScript === null)
    return null
  const additional = manifest.themes.some(theme => theme.id !== manifest.defaultTheme && isSelectableTheme(manifest, theme))
  if (!additional)
    return null
  return { manifest, stale: headScript, fresh: createThemeScript(manifest, options) }
}

const escapeAttribute = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')

/**
 * Лист дополнительной темы, чью пару сервер уже поставил на `<html>`.
 *
 * Скрипт, увидев на корне знакомую пару, ничего не делает — и лист её темы не
 * вставляет. Без листа пара дала бы значения основной темы под чужим именем,
 * пока его не догрузит клиент. Лейаут поставить лист сам не может: свой `<head>`
 * Astro дописывает листами стилей после него, и лист темы оказался бы в каскаде
 * раньше основного.
 */
function sheetForRootPair(html: string, manifest: GranumThemeManifest): string {
  const attribute = manifest.activation.attribute
  const pair = new RegExp(`<html\\b[^>]*\\s${attribute}="([^"]*)"`).exec(html)?.[1]
  const selection = resolveThemeActivation(manifest, pair)
  if (!selection || selection.theme.id === manifest.defaultTheme)
    return ''
  if (html.includes(`${THEME_SHEET_ATTRIBUTE}="${selection.theme.id}"`))
    return ''
  const link = themeSheetLink(manifest, selection.theme.id)
  if (!link)
    return ''
  return `<link ${Object.entries(link).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(' ')}>`
}

/** Подменить скрипт режима в `<head>` и поставить лист темы, чью пару выбрал сервер. */
export function applyThemeHead(html: string, head: ThemeHead): string {
  const end = html.indexOf('</head>')
  const at = html.indexOf(head.stale)
  if (at === -1 || (end !== -1 && at > end))
    return html
  // Лист — до `<script>`, а не внутрь: скрипт и лист стоят на месте вставленного скрипта.
  const open = html.lastIndexOf('<script', at)
  const sheet = sheetForRootPair(html, head.manifest)
  return html.slice(0, open) + sheet + html.slice(open, at) + head.fresh + html.slice(at + head.stale.length)
}
