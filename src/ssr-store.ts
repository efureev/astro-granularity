import type { PageStore } from './ssr'
import { AsyncLocalStorage } from 'node:async_hooks'
import { installPageStore } from './ssr'

/**
 * Состояние страницы на `AsyncLocalStorage` — серверная половина шва.
 *
 * Модуль серверный и только серверный: его импортирует `ssr-middleware.ts`, а
 * тот попадает лишь в `middleware.js`. В браузерный бандл `node:async_hooks`
 * так не уезжает, хотя сам шов (`ssr.ts`) изоморфен и уезжает.
 *
 * **Почему не модульная переменная, как было.** Она верна ровно там, где
 * страницы рендерятся по одной: пререндер статики. Под адаптером запросы идут
 * параллельно в одном процессе, и состояние одного затирало бы другое — язык
 * одного посетителя попал бы в ответ другому. Интеграция поэтому просто не
 * включала фичу при `output: 'server'`, а платой была английская разметка на
 * локализованных маршрутах и отсутствие снимка строк.
 *
 * `AsyncLocalStorage` снимает ограничение целиком: у каждого запроса свой
 * контекст, и `build.concurrency` перестаёт иметь значение тоже.
 */
type PageState = { locale: string, used: Set<string> }

const storage = new AsyncLocalStorage<PageState>()

const store: PageStore = {
  locale: () => storage.getStore()?.locale ?? null,
  record: (key) => { storage.getStore()?.used.add(key) },
  used: () => {
    const state = storage.getStore()
    return state ? [...state.used] : []
  },
}

installPageStore(store)

/**
 * Отрисовать страницу в собственном контексте.
 *
 * Границей владеет вызывающий, а не пара «открыть/закрыть»: состояние живёт
 * ровно столько, сколько исполняется `render`, и утечь в соседний запрос ему
 * физически неоткуда. Упавший рендер тоже ничего за собой не оставляет —
 * снимать нечего, контекст уходит со стеком.
 */
export function runPage<T>(locale: string, render: () => Promise<T>): Promise<T> {
  return storage.run({ locale, used: new Set() }, render)
}
