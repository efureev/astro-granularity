/**
 * Шов между серверным middleware и точкой входа острова.
 *
 * Здесь нет импортов из `@feugene/fint-i18n` и `vue` даже в типах — по той же
 * причине, что и в `runtime.ts`: приложение вправе взять другой i18n-рантайм.
 * Middleware знает только форму снимка, а снимает его тот, кто создал инстанс.
 *
 * Модуль изоморфный: `beginPage`/`endPage`/`recordUsedKey` работают на сборке,
 * `readSnapshotFromDocument` — в браузере.
 */

/**
 * Снимок строк, переносимый со сборки в браузер.
 *
 * `messages` вложен ровно так, как этого ждёт `hydrate` у fint: первый уровень —
 * локаль, второй — **имя блока**, дальше поддерево сообщений.
 *
 * Локаль лежит внутри снимка, хотя fint её туда намеренно не кладёт: там она
 * состояние приложения, а здесь — единственная запись о том, чем рисовал
 * сервер. Читать её из `<html lang>` значило бы сверять клиент со вторым
 * источником, который может и разойтись (`lang="ru-RU"` против локали `ru`).
 */
export type GranularityI18nSnapshot = {
  locale: string
  messages: Record<string, Record<string, unknown>>
  blocks: Record<string, string[]>
}

/** Атрибут-метка блока со снимком. */
export const SNAPSHOT_ATTR = 'data-granularity-i18n'

type PageState = { locale: string, used: Set<string> }

/**
 * Состояние одной страницы сборки.
 *
 * Модульная переменная, а не поле инстанса: пререндер — один процесс, страницы
 * генерируются последовательно, и middleware оборачивает рендер каждой. При
 * `build.concurrency > 1` этого достаточно не было бы, поэтому интеграция при
 * таком конфиге фичу не включает вовсе.
 */
let page: PageState | null = null

export function beginPage(locale: string): void {
  page = { locale, used: new Set() }
}

export function endPage(): void {
  page = null
}

/**
 * Локаль текущей страницы сборки, объявленная middleware.
 *
 * `null` вне рендера страницы и всегда в браузере — там локаль берётся из
 * снимка либо из `<html lang>`.
 */
export function readServerPageLocale(): string | null {
  return page?.locale ?? null
}

/** Отметить ключ отрисованным. Вне рендера страницы — молча ничего. */
export function recordUsedKey(key: string): void {
  page?.used.add(key)
}

/** Ключи, отрисованные на текущей странице. Вне рендера — пусто. */
export function usedKeys(): readonly string[] {
  return page ? [...page.used] : []
}

/** Построитель снимка регистрирует тот, кто создал инстанс i18n. */
export type SnapshotBuilder = (locale: string, used: readonly string[]) => GranularityI18nSnapshot | null

let builder: SnapshotBuilder | null = null

export function registerSnapshotBuilder(fn: SnapshotBuilder): void {
  builder = fn
}

/**
 * Снимок текущей страницы.
 *
 * `null`, когда снимать нечего: ни один остров не спросил строк, значит и
 * трогать HTML незачем.
 */
export function buildPageSnapshot(): GranularityI18nSnapshot | null {
  if (!page || !builder)
    return null
  return builder(page.locale, usedKeys())
}

/**
 * Снимок строкой, готовой лечь внутрь `<script>`.
 *
 * Экранируется каждый `<`, а не только `</script`: внутри raw-text элемента
 * выйти можно ещё и через `<!--`. `<` — валидный JSON, `JSON.parse` вернёт
 * обратно `<`. В выводе `JSON.stringify` символ `<` встречается только внутри
 * строковых литералов, поэтому замена не может испортить структуру.
 */
export function serializeSnapshot(snapshot: GranularityI18nSnapshot): string {
  return JSON.stringify(snapshot).replaceAll('<', '\\u003c')
}

/**
 * Вложить снимок в HTML страницы.
 *
 * Перед `</head>`, а не сразу после `<head>`: снимок в килобайт вытолкнул бы
 * `<meta charset>` за первые 1024 байта, и браузер начал бы угадывать кодировку.
 *
 * `type="application/json"` вместо инлайн-скрипта — тоже не оформление. Такой
 * блок браузер не исполняет, поэтому `script-src` его не касается; настоящий
 * инлайн-скрипт при включённом `security.csp` был бы заблокирован — захэшировать
 * его неоткуда, страница на этот момент уже отрисована.
 *
 * Нет `</head>` (фрагмент, partial) — HTML возвращается как есть: портить чужую
 * разметку ради строк нельзя.
 */
export function injectSnapshot(html: string, json: string): string {
  const at = html.indexOf('</head>')
  if (at === -1)
    return html
  const block = `<script type="application/json" ${SNAPSHOT_ATTR}>${json}</script>`
  return html.slice(0, at) + block + html.slice(at)
}

/** Снимок из разметки страницы. `null`, если его нет или он испорчен. */
export function readSnapshotFromDocument(): GranularityI18nSnapshot | null {
  if (typeof document === 'undefined')
    return null
  const element = document.querySelector(`script[type="application/json"][${SNAPSHOT_ATTR}]`)
  const text = element?.textContent
  if (!text)
    return null
  try {
    return JSON.parse(text) as GranularityI18nSnapshot
  }
  catch {
    // Испорченный снимок не повод ронять остров: без него строки просто
    // доедут догрузкой, как до появления фичи.
    return null
  }
}
