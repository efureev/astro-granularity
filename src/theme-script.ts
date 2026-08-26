import type { DefaultTheme, ThemeName } from './options'

/**
 * Бюджет инлайн-скрипта. Он блокирует отрисовку по определению, поэтому растёт
 * только осознанно: превышение роняет сборку пакета.
 */
export const THEME_SCRIPT_BUDGET_BYTES = 512

/**
 * Правило выбора темы, вынесенное из скрипта, чтобы его можно было проверить
 * без исполнения строки. Скрипт и эта функция обязаны совпадать во всех
 * сочетаниях входов — это и проверяет `theme-script.test.ts`.
 */
export function resolveTheme(
  stored: string | null,
  systemPrefersDark: boolean,
  defaultTheme: DefaultTheme,
): ThemeName {
  if (stored === 'light' || stored === 'dark')
    return stored
  if (defaultTheme === 'light' || defaultTheme === 'dark')
    return defaultTheme
  return systemPrefersDark ? 'dark' : 'light'
}

/**
 * Инлайн-скрипт, ставящий тему **до первой отрисовки**.
 *
 * Почему не импорт `initThemeEarly` из ядра: любой модуль — это сетевой запрос
 * и разбор до кадра. Скрипт обязан исполниться синхронно из `<head>`, поэтому
 * правило выбора здесь продублировано, а совпадение с ядром держится гейтом.
 *
 * `color-scheme` ставится потому, что ядро его не задаёт: без него нативные
 * скроллбары, `<select>` и поля ввода останутся светлыми на тёмной странице.
 */
export function createThemeScript(storageKey: string, defaultTheme: DefaultTheme): string {
  const key = JSON.stringify(storageKey)
  // `typeof`, а не `matchMedia&&…`: при отсутствующем `matchMedia` короткое
  // замыкание вернуло бы `undefined`, и в атрибут уехала бы строка "undefined".
  const fallback = defaultTheme === 'system'
    ? '(typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")'
    : JSON.stringify(defaultTheme)

  // Внешний try/catch: без него исключение в `<head>` останавливает разбор
  // документа, и страница не отрисуется вообще. Внутренний — только под
  // `localStorage`: в приватном режиме Safari он бросает на чтении.
  return `(function(){try{var k=${key},s=null;try{s=localStorage.getItem(k)}catch(e){}`
    + `var t=s==="light"||s==="dark"?s:${fallback},r=document.documentElement;`
    + `r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})()`
}

export function assertThemeScriptBudget(script: string): void {
  const bytes = Buffer.byteLength(script, 'utf8')
  if (bytes > THEME_SCRIPT_BUDGET_BYTES) {
    throw new Error(
      `[astro-granularity] скрипт темы — ${bytes} Б при бюджете ${THEME_SCRIPT_BUDGET_BYTES} Б. `
      + 'Он блокирует первую отрисовку, поэтому бюджет поднимается решением, а не молча.',
    )
  }
}
