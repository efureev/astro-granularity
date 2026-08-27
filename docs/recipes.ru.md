# Рецепты

[English](./recipes.md) · **Русский**

Семь способов подключить интеграцию. Они различаются тем, какие части включены, а не
стилем, — выбирайте тот, чьи ограничения совпадают с вашими.

| # | Рецепт | Vue | Строки | UnoCSS |
| --- | --- | --- | --- | --- |
| [1](#1-только-тема) | Только тема | — | — | необязателен |
| [2](#2-полный-набор) | Полный набор | ✓ | ✓ | ✓ |
| [3](#3-без-unocss) | Без UnoCSS | ✓ | ✓ | — |
| [4](#4-свой-i18n-рантайм) | Свой i18n-рантайм | ✓ | свои | ✓ |
| [5](#5-со-спутниками) | Со спутниками | ✓ | ✓ | ✓ |
| [6](#6-многоязычный-с-clientrouter) | Многоязычный + `ClientRouter` | ✓ | ✓ | ✓ |
| [7](#7-ssr-за-адаптером) | SSR за адаптером | ✓ | частично | ✓ |

---

## 1. Только тема

Нужна тёмная тема без мигания и больше ничего. Ни Vue-островов, ни переводов
компонентов, возможно, и самих компонентов дизайн-системы нет.

```js
// astro.config.mjs
import granularity from '@feugene/astro-granularity'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    granularity({
      i18n: false,      // виртуальный модуль лоадеров не порождать вовсе
      resolver: false,  // без Vue авто-импортировать нечего
      strict: false,    // не требовать @astrojs/vue и пресет UnoCSS
    }),
  ],
})
```

**Что получаете.** Один синхронный инлайн-скрипт в `<head>`, около 370 байт. Читает
сохранённый выбор, откатывается к `prefers-color-scheme`, пишет `data-theme` и
`color-scheme` на `<html>` и применяет себя заново после клиентского перехода.

**Что обязаны дать сами.** То, что тему **пишет**, — см.
[Тема](./theme.ru.md#свой-переключатель). И CSS, реагирующий на `data-theme`; токены
дизайн-системы реагируют, если их подключить.

**Почему `strict: false`.** Проверка окружения существует, чтобы поймать наполовину
настроенную связку Vue + UnoCSS. Здесь проверять нечего, и оставленная включённой она
уронила бы сборку из-за отсутствия, выбранного намеренно.

---

## 2. Полный набор

Дефолт, с которого начинает большинство. Vue-острова, строки компонентов в HTML,
авто-импорт, проверки окружения.

```js
// astro.config.mjs
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import { defineConfig } from 'astro/config'
import UnoCSS from 'unocss/astro'

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
    UnoCSS({ injectReset: true }),
    granularity({ i18n: { locales: ['en', 'ru'] } }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
    routing: { prefixDefaultLocale: false },
  },
})
```

Три вещи здесь несущие и легко теряются:

1. **`appEntrypoint`** — без него экземпляр i18n не создаётся вовсе, и компоненты
   показывают свои литеральные английские подписи.
2. **Блок `i18n` в конфиге самого Astro** — без него `Astro.currentLocale` равен
   `undefined`, и язык маршрута приходится угадывать по первому сегменту пути. См.
   [Строки](./i18n.ru.md#откуда-берётся-язык-маршрута).
3. **`site`** — нужен канонической ссылке, `hreflang` и карте сайта. Самой интеграции он
   не нужен, но вам понадобится.

`uno.config.ts` — в [README](../README.ru.md#быстрый-старт).

---

## 3. Без UnoCSS

Проект, у которого уже есть свой конвейер стилей и второй не нужен.

```js
integrations: [
  vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
  granularity({
    injectStyleBundle: true,  // подтянуть @feugene/granularity/styles.css
    strict: false,            // проверка пресета упала бы — пресета нет
    i18n: { locales: ['en', 'ru'] },
  }),
]
```

**Что теряете.** Утилитарные классы, которые пресет генерирует для компонентов. Бандл
несёт токены, темы, базовый слой и preflights — но не покомпонентные утилиты. Компоненты
будут оформлены, а часть раскладочных классов, которыми пользуется разметка
дизайн-системы, окажется отсутствующей.

**Никогда не включайте `injectStyleBundle` вместе с работающим `presetGranularNode`.**
Пресет уже эмитит токены и обе темы как preflights; бандл удвоил бы каждый из них.

---

## 4. Свой i18n-рантайм

Формат лоадеров, который публикует экосистема, — `fint-i18n`, поэтому готовая точка входа
`./app` подключает именно его. Приложению с другим рантаймом она не нужна.

```js
// astro.config.mjs
integrations: [
  vue({ appEntrypoint: './src/vue-app.ts' }),
  UnoCSS({ injectReset: true }),
  granularity({ i18n: false }),
]
```

```ts
// src/vue-app.ts
import type { App } from 'vue'
import { provideGranularityI18n } from '@feugene/astro-granularity/runtime'
import { myTranslator } from './i18n'

export default function setup(app: App) {
  provideGranularityI18n(app, {
    t: (key, params) => myTranslator.translate(key, params),
    te: key => myTranslator.has(key),
  })
}
```

Ядро спрашивает у адаптера `t` и, если есть, `te`. По умолчанию адаптер кладётся и под
ключ `fint-i18n`: пакеты экосистемы, не перешедшие на композабл ядра, ищут инстанс только
там, и без этого молча показывают английский fallback. Передайте
`{ alsoFintKey: false }`, если приложение само зовёт `installI18n`, — иначе два провайда
борются за один ключ, и побеждает последний.

**Снимок строк придётся собрать самим.** `readServerPageLocale()` и
`readSnapshotFromDocument()` экспортируются из `./runtime`, но при `i18n: false`
middleware не регистрируется и снимок не порождается. См.
[Строки](./i18n.ru.md#шов-для-своего-рантайма).

---

## 5. Со спутниками

Помимо ядра экосистема публикует пакеты со своими компонентами и своими блоками строк.

```js
granularity({
  i18n: {
    packages: ['@feugene/granularity-chrono'],
    locales: ['en', 'ru', 'es'],
  },
})
```

```ts
// uno.config.ts — спутнику нужен и свой провайдер
import chronoProvider from '@feugene/granularity-chrono/granular-provider/node'
import granularityProvider from '@feugene/granularity/granular-provider/node'

const options = {
  providers: [granularityProvider, chronoProvider],
  components: [
    { provider: '@feugene/granularity', names: ['GrButton', 'GrCard'] },
    { provider: '@feugene/granularity-chrono', names: ['GrDatePicker'] },
  ],
  themes: { names: ['light', 'dark'] },
}
```

**Имена блоков нигде не перечисляются.** `deriveI18nBlocks` читает их из коллекций
лоадеров, где они лежат вторым уровнем ключа. Это важно потому, что имя блока не
выводится из имени пакета: `granularity-forms-schema` объявляет `grForms`.

Список компонентов — в **квалифицированной** форме (`{ provider, names }`): короткое имя
допускается только внутри `dependencies` самого компонента. Транзитивные зависимости
резолвит пресет, поэтому `GrDialog` приводит с собой `GrModal`.

---

## 6. Многоязычный с `ClientRouter`

`ClientRouter` подменяет документ, не переисполняя модули, и всё, что живёт вне разметки,
этим сбрасывается.

```js
// astro.config.mjs — как в рецепте 2, только три языка
i18n: {
  defaultLocale: 'en',
  locales: ['en', 'ru', 'es'],
  routing: { prefixDefaultLocale: false },
}
```

```astro
---
// src/layouts/Base.astro
import { ClientRouter } from 'astro:transitions'
---
<head>
  <ClientRouter />
</head>
```

Обе половины того, что ломает подмена, интеграция закрывает сама: скрипт темы
переподписывается через `astro:after-swap`, а снимок строк перечитывается на каждом
создании инстанса. Делать для этого ничего не нужно.

**А вот что нужно:** ходить через роутер. Переключатель языка, присваивающий
`window.location.href`, делает жёсткую навигацию в обход роутера — страница
перезагружается, состояние теряется, и любой тест поверх этого меряет не то.

```ts
import { navigate } from 'astro:transitions/client'

watch(selected, (value) => {
  const next = links.find(link => link.value === value)
  if (next)
    void navigate(next.href)
})
```

Подробности и способы отказа — в [Теме](./theme.ru.md#клиентская-навигация) и
[Строках](./i18n.ru.md#клиентская-навигация).

---

## 7. SSR за адаптером

Работает всё, кроме одного, и это одно выключает себя само.

```js
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
    UnoCSS({ injectReset: true }),
    granularity({
      i18n: {
        locales: ['en', 'ru'],
        ssrStrings: false,  // убирает предупреждение ниже
      },
    }),
  ],
})
```

**Строки в HTML при `output: 'server'` недоступны.** Состояние страницы, из которого
собирается снимок, — модульная переменная, а запросы обрабатываются параллельно в одном
процессе: `beginPage` одного запроса затёр бы состояние другого, и страница могла бы
уехать с чужим языком. Интеграция это распознаёт и отказывает, выводя предупреждение с
починкой, вместо того чтобы отдать гонку.

`ssrStrings: false` объявляет решение принятым и убирает предупреждение. Переводы после
этого приезжают обычным путём — клиент догружает чанк словаря после гидратации, ровно
как до появления этой механики.

Компромисс честный, а не полный: страницы, помеченные `prerender = true`, были бы
безопасны, но отличить их в `astro:config:setup` нечем, поэтому безопасное поведение
выбирается для всех.

**Остальное не затронуто**: скрипт темы, авто-импорт, проверка окружения и все компоненты
ведут себя точно так же.
