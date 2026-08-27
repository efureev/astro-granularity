/// <reference path="../client.d.ts" />
import type { LocaleLoaderSource } from '@feugene/fint-i18n/core'
import type { App } from 'vue'
import type { GranularityI18nSnapshot } from './ssr'
import { blocks, defaultLocale, loaders, ssrStrings } from 'virtual:granularity/i18n'
import { createFintI18n, getSSRState, hydrate } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { readPageLocale } from './runtime'
import { readServerPageLocale, readSnapshotFromDocument, recordUsedKey, registerSnapshotBuilder } from './ssr'

type FintI18n = ReturnType<typeof createFintI18n>

/**
 * Готовая обвязка на `@feugene/fint-i18n` — точка входа для
 * `vue({ appEntrypoint: '@feugene/astro-granularity/app' })`.
 *
 * Формат лоадеров, который публикуют пакеты экосистемы, — fint-овский
 * (`LocaleLoaderCollection`), поэтому здесь он и подключается напрямую.
 * Приложению с другим i18n-рантаймом эта точка входа не нужна: оно пишет свою
 * и раздаёт адаптер через `provideGranularityI18n` из
 * `@feugene/astro-granularity/runtime`, а лоадеры конвертирует само.
 */
const isServer = typeof document === 'undefined'

/**
 * Снимок читается на каждое создание инстанса, а не однажды на модуль.
 *
 * `ClientRouter` подменяет `<head>` целиком, но модуль при этом не
 * переисполняется. Прочитанный один раз снимок означал бы, что после
 * клиентского перехода строки остаются на языке первой открытой страницы.
 */
function currentSnapshot(): GranularityI18nSnapshot | null {
  return isServer ? null : readSnapshotFromDocument()
}

/**
 * Экземпляр на локаль, а не один на модуль.
 *
 * В браузере карта всегда содержит одну запись и работает как синглтон: острова
 * Astro — независимые корни Vue с общим графом модулей, поэтому словарь грузится
 * однажды, а переключение языка доходит до всех сразу.
 *
 * На сборке разница несущая: пререндер — один процесс на весь билд, и
 * единственный экземпляр зафиксировал бы локаль первой отрендеренной страницы
 * для всех остальных.
 */
const instances = new Map<string, FintI18n>()

/**
 * Язык страницы.
 *
 * На сборке его объявляет middleware, и взяться ему больше неоткуда: `document`
 * там нет, а маршрут `@astrojs/vue` в точку входа не передаёт — `setup` получает
 * только `app`.
 *
 * В браузере снимок важнее `<html lang>`: он запись о том, чем рисовал сервер, и
 * потому не расходится с ним на региональных тегах вроде `lang="ru-RU"`.
 */
function resolveLocale(snapshot: GranularityI18nSnapshot | null): string {
  return readServerPageLocale() ?? snapshot?.locale ?? readPageLocale(defaultLocale)
}

export function getGranularityI18n(): FintI18n {
  const snapshot = currentSnapshot()
  const locale = resolveLocale(snapshot)
  const existing = instances.get(locale)
  if (existing)
    return existing

  const instance = createFintI18n({
    locale,
    fallbackLocale: defaultLocale,
    // Без этого `fallbackLocale` объявлен, но пуст до первого переключения
    // языка, и отсутствующий ключ показывает сам ключ, а не английский текст.
    preloadFallback: true,
    // Приведение — единственное место, где форма лоадеров встречается с типами
    // `fint-i18n`. `runtime.ts` описывает её структурно (`Record<локаль,
    // Record<блок, unknown>>`) и намеренно не импортирует fint: приложение
    // вправе взять другой рантайм. Здесь fint уже выбран, и лист сужается до
    // `LocaleBlockLoaders`.
    loaders: loaders as LocaleLoaderSource,
  })
  // Блоки выведены из самих лоадеров: имя блока лежит внутри коллекции вторым
  // уровнем ключа, поэтому приложению не нужно перечислять `*_I18N_BLOCK`.
  instance.registerBlocks(blocks)
  if (loaders.length > 0 && blocks.length === 0) {
    // Пустой список при непустых лоадерах означает, что какой-то пакет отдаёт
    // не `{ локаль: { блок: лоадер } }`. Строки при этом молча уйдут в
    // английский fallback, поэтому говорим вслух — но не роняем страницу.
    console.warn(
      '[astro-granularity] лоадеры есть, а блоков не выведено ни одного. '
      + 'Вероятно, подключён пакет, чей `/i18n` отдаёт не `{ локаль: { блок: лоадер } }`.',
    )
  }
  instances.set(locale, instance)

  if (isServer && ssrStrings === 'used') {
    instance.hooks.on('onTranslate', (payload) => {
      // Только блочное тело и никакого `return`: `emitSync` подменяет payload
      // любым не-`undefined` возвратом, а `t()` читает из подменённого `.result`.
      // Стрелка `payload => used.add(payload.key)` вернула бы `Set` — и `t()`
      // начал бы отдавать сам ключ на всём сайте.
      recordUsedKey(payload.key)
    })
  }
  else if (!isServer && snapshot) {
    // Синхронно и до `app.mount`: `@astrojs/vue` ждёт нашу точку входа, поэтому
    // первый клиентский рендер уже видит строки и совпадает с серверным.
    hydrate(instance, snapshot as Parameters<typeof hydrate>[1])
  }

  return instance
}

/**
 * Поддерево сообщений, суженное до перечисленных ключей.
 *
 * Ключ приходит точками (`gr.pagination.next`), и `messages[локаль]` устроен так
 * же: первый сегмент — имя блока, дальше вложенность. Лист копируется как есть:
 * строкой он может и не быть — набор плюральных форм тоже лист, хотя и объект.
 */
function pickKeys(
  source: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!source)
    return null

  const picked: Record<string, unknown> = {}
  let found = false

  for (const key of keys) {
    const path = key.split('.')
    let from: unknown = source
    for (const segment of path) {
      if (typeof from !== 'object' || from === null) {
        from = undefined
        break
      }
      from = (from as Record<string, unknown>)[segment]
    }
    if (from === undefined)
      continue

    let into = picked
    for (const segment of path.slice(0, -1)) {
      if (typeof into[segment] !== 'object' || into[segment] === null)
        into[segment] = {}
      into = into[segment] as Record<string, unknown>
    }
    into[path[path.length - 1]!] = from
    found = true
  }

  return found ? picked : null
}

/**
 * Снимок строк текущей страницы.
 *
 * `null`, когда переносить нечего: ни один остров не спросил строк — значит и
 * трогать HTML незачем.
 */
function buildSnapshot(locale: string, used: readonly string[]): GranularityI18nSnapshot | null {
  const i18n = instances.get(locale)
  if (!i18n)
    return null

  if (ssrStrings === 'full') {
    const state = getSSRState(i18n, { locales: [locale] })
    if (Object.keys(state.messages).length === 0)
      return null
    return { locale, messages: state.messages, blocks: state.blocks }
  }

  const messages: GranularityI18nSnapshot['messages'] = {}
  const own = pickKeys(i18n.messages[locale], used.filter(key => i18n.te(key, locale)))
  if (own)
    messages[locale] = own

  // `preloadFallback` тянет на сборке и запасную локаль, поэтому сервер мог
  // отрисовать английский текст для ключа, которого в основной локали нет.
  // Такие ключи переносятся поштучно: иначе ровно они мигнули бы **сырым
  // ключом**, а в режиме `full` — необратимо, там клиент запасную локаль уже
  // не загрузит.
  const fallback = i18n.fallbackLocale
  if (fallback && fallback !== locale) {
    const rescued = pickKeys(
      i18n.messages[fallback],
      used.filter(key => !i18n.te(key, locale) && i18n.te(key, fallback)),
    )
    if (rescued)
      messages[fallback] = rescued
  }

  if (Object.keys(messages).length === 0)
    return null

  // `blocks` пуст намеренно: блок не помечается загруженным, поэтому клиент
  // всё равно догрузит словарь фоном и долечит всё, чего журнал не поймал, —
  // строки из `tm()`, например. Режим не может выйти хуже отсутствия снимка.
  return { locale, messages, blocks: {} }
}

if (isServer && ssrStrings !== false)
  registerSnapshotBuilder(buildSnapshot)

/** Точка входа для `vue({ appEntrypoint: '@feugene/astro-granularity/app' })`. */
export default async function setup(app: App): Promise<void> {
  const i18n = getGranularityI18n()

  if (isServer) {
    try {
      // Промис ждут, и это вся разница между русским HTML и английским:
      // `renderToString` иначе уходит вперёд словаря, и в разметке остаются
      // литеральные fallback'и компонентов. Ждать можно потому, что
      // `@astrojs/vue` вызывает точку входа как `await setup(app)`.
      //
      // Ошибка гасится здесь, а не всплывает: наверху её поймал бы
      // `astro-island.start()` как отказ гидратации, и остров не смонтировался
      // бы вовсе — потеря интерактивности вместо потери перевода.
      await i18n.loadUsedBlocks(i18n.locale.value)
    }
    catch (error) {
      console.warn('[astro-granularity] словарь не загрузился на сборке — строки уйдут в fallback.', error)
    }
  }
  else {
    // Клиент не ждёт: строки первого кадра уже пришли снимком, а ожидание
    // отложило бы монтирование острова на целый чанк словаря.
    void i18n.loadUsedBlocks(i18n.locale.value)
  }

  installI18n(app, i18n)
}
