# Рецепты

[English](./recipes.md) · **Русский**

Шесть способов подключить интеграцию. Они различаются тем, какие части включены, а не стилем, — выбирайте тот, чьи
ограничения совпадают с вашими.

| #                                   | Рецепт                        | Vue | Строки   | UnoCSS |
|-------------------------------------|-------------------------------|-----|----------|--------|
| [1](#1-покомпонентная-установка)    | Покомпонентная установка      | ✓  | ✓       | ✓     |
| [2](#2-установка-всех-компонентов)  | Установка всех компонентов    | ✓  | ✓       | ✓     |
| [3](#3-свой-i18n-рантайм)           | Свой i18n-рантайм             | ✓  | свои     | ✓     |
| [4](#4-со-спутниками)               | Со спутниками                 | ✓  | ✓       | ✓     |
| [5](#5-многоязычный-с-clientrouter) | Многоязычный + `ClientRouter` | ✓  | ✓       | ✓     |
| [6](#6-серверный-рендеринг)         | Серверный рендеринг           | ✓  | нет      | ✓     |

---

## 1. Покомпонентная установка

Рецепт, с которого стоит начинать, и то, ради чего дизайн-система устроена именно так.
Вы называете компоненты, которые действительно ставите в разметку; всё остальное
выводится из этого списка.

Файла два, и важны оба — интеграция и таблица стилей настраиваются по отдельности.

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

```ts
// uno.config.ts
import { defineConfig, presetMini } from 'unocss'
import { granularContent, presetGranularNode } from '@feugene/unocss-preset-granular/node'
import provider from '@feugene/granularity/granular-provider/node'

const options = {
  providers: [provider],
  components: [
    { provider: '@feugene/granularity', names: ['GrButton', 'GrCard'] },
  ],
  themes: { names: ['light', 'dark'] },
}

export default defineConfig({
  presets: [presetMini(), presetGranularNode(options)],
  content: {
    ...granularContent(options),
    filesystem: [
      ...(granularContent(options).filesystem ?? []),
      'src/**/*.{vue,astro,ts}',
    ],
  },
})
```

Это вся установка: острова на Vue, строки компонентов в HTML, авто-импорт, проверки
окружения и ровно столько CSS, сколько нужно двум компонентам.

### Три вещи, которые легко потерять и дорого искать

1. **`appEntrypoint`** — без него инстанс i18n не создаётся вовсе, и компоненты
   откатываются к своим английским литералам.
2. **Блок `i18n` в конфиге самого Astro** — без него `Astro.currentLocale` равен
   `undefined`, и язык маршрута приходится угадывать по первому сегменту пути. См.
   [Строки](./i18n.ru.md#откуда-берётся-язык-маршрута).
3. **`site`** — нужен для canonical, `hreflang` и карты сайта. Интеграция его не читает,
   но он вам понадобится.

Из списка компонентов интеграция не читает ничего: выбор живёт целиком в
`uno.config.ts`. Один и тот же объект `options` обязан уйти и в `presetGranularNode`, и
в `granularContent` — первое решает, что эмитить, второе — что сканировать; разъедутся,
и компоненты приедут неоформленными.

### Чего стоит выбор

Сгенерированный CSS, замерено на этом репозитории с `@feugene/granularity@0.36.0` и
пресетом `0.13.0`:

| Выбор | CSS | Файлов библиотеки сканируется |
| --- | --- | --- |
| `GrButton` | 44 713 Б | 2 |
| `GrButton`, `GrCard` | 45 695 Б | 4 |
| Пять, как в `example/` | 66 778 Б | 20 |
| `'all'` | 113 996 Б | 158 |

Первую строку надо читать как пол: около 44 КБ — это токены, обе темы, базовый слой и
preflight'ы, и они там будут при сколь угодно скромном выборе. Второй компонент
добавляет около 1 КБ. Эта форма и есть смысл: за дизайн-систему платят один раз, а
компоненты после этого дёшевы.

### Как работать со списком

**Транзитивные зависимости приезжают сами.** `GrDialog` тянет `GrModal`, `GrSelect` —
чипы, которые рендерит. Вы перечисляете то, что пишете, а не то, что этим компонентам
понадобилось: граф — забота провайдера, не ваша.

**Квалифицированная форма — безопасная.** `{ provider, names }` говорит, какому
провайдеру принадлежит имя; голая строка допускается только внутри `dependencies`
самого компонента. С одним провайдером работают обе, но квалифицированная не меняет
смысла, когда появится второй.

**Несуществующее имя роняет сборку**, и ошибка перечисляет то, что у провайдера есть:

```
ComponentNotFoundError: Component '@feugene/granularity:GrButtn' not found.
Available in '@feugene/granularity': [GrAlert, GrAutocomplete, …]
```

**Компонент, добавленный в разметку, но не сюда, приедет неоформленным** — без цвета,
отступов и размеров. Ничего при этом не упадёт, страница просто будет выглядеть не так.
Если симптом такой — смотреть надо сюда в первую очередь.

У пресета есть CLI ровно под эти вопросы:

```bash
npx granular explain ./granular.options.mjs '@feugene/granularity:GrModal'  # почему он в сборке
npx granular why-css ./granular.options.mjs 'rounded-lg'                    # кто притащил класс
npx granular doctor  ./granular.options.mjs                                 # вся конфигурация
```

Он читает обычный модуль, экспортирующий опции, — значит, их надо вынести из
`uno.config.ts` в `granular.options.mjs` и импортировать обратно, иначе подавать нечего.

---

## 2. Установка всех компонентов

`astro.config.mjs` тот же, что в рецепте 1, — различается только выбор.

```ts
const options = {
  providers: [provider],
  components: 'all',
  themes: { names: ['light', 'dark'] },
}
```

Все 78 компонентов ядра и 113 996 Б CSS против 45 695 Б у двух — и каждый байт блокирует
первую отрисовку, потому что это таблица стилей документа.

**Оправдано, когда набор компонентов заранее действительно неизвестен**: админка,
собираемая по схеме, конструктор страниц, сайт документации, отрисовывающий
произвольные демо. Там альтернатива — не более короткий список, а список, который молча
устаревает, и компонент, приезжающий в продакшен неоформленным.

**Не оправдано как способ не писать список.** Сайт с известным набором страниц знает
свои компоненты; `'all'` покупает там 68 КБ блокирующих стилей ценой неправки одного
массива.

Сканирование тоже растёт: 158 файлов библиотеки против 4. Это время сборки, а не
рантайма, но и оно не бесплатно.

---

## 3. Свой i18n-рантайм

Формат лоадеров, который публикует экосистема, — `fint-i18n`, поэтому готовая точка входа
`./app` подключает именно его. Приложению с другим рантаймом она не нужна.

```js
// astro.config.mjs
integrations: [
    vue({appEntrypoint: './src/vue-app.ts'}),
    UnoCSS({injectReset: true}),
    granularity({i18n: false}),
]
```

```ts
// src/vue-app.ts
import type {App} from 'vue'
import {provideGranularityI18n} from '@feugene/astro-granularity/runtime'
import {myTranslator} from './i18n'

export default function setup(app: App) {
    provideGranularityI18n(app, {
        t: (key, params) => myTranslator.translate(key, params),
        te: key => myTranslator.has(key),
    })
}
```

Ядро спрашивает у адаптера `t` и, если есть, `te`. По умолчанию адаптер кладётся и под ключ `fint-i18n`: пакеты
экосистемы, не перешедшие на композабл ядра, ищут инстанс только там, и без этого молча показывают английский fallback.
Передайте
`{ alsoFintKey: false }`, если приложение само зовёт `installI18n`, — иначе два провайда борются за один ключ, и
побеждает последний.

**Снимок строк придётся собрать самим.** `readServerPageLocale()` и
`readSnapshotFromDocument()` экспортируются из `./runtime`, но при `i18n: false`
middleware не регистрируется и снимок не порождается. См.
[Строки](./i18n.ru.md#шов-для-своего-рантайма).

---

## 4. Со спутниками

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
        {provider: '@feugene/granularity', names: ['GrButton', 'GrCard']},
        {provider: '@feugene/granularity-chrono', names: ['GrDatePicker']},
    ],
    themes: {names: ['light', 'dark']},
}
```

**Имена блоков нигде не перечисляются.** `deriveI18nBlocks` читает их из коллекций лоадеров, где они лежат вторым
уровнем ключа. Это важно потому, что имя блока не выводится из имени пакета: `granularity-forms-schema` объявляет
`grForms`.

Список компонентов — в **квалифицированной** форме (`{ provider, names }`): короткое имя допускается только внутри
`dependencies` самого компонента. Транзитивные зависимости резолвит пресет, поэтому `GrDialog` приводит с собой
`GrModal`.

---

## 5. Многоязычный с `ClientRouter`

`ClientRouter` подменяет документ, не переисполняя модули, и всё, что живёт вне разметки, этим сбрасывается.

```js
// astro.config.mjs — как в рецепте 1, только три языка
{
    i18n: {
      defaultLocale: 'en',
      locales: ['en', 'ru', 'es'],
      routing: { prefixDefaultLocale: false },
   }
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

Обе половины того, что ломает подмена, интеграция закрывает сама: скрипт темы переподписывается через
`astro:after-swap`, а снимок строк перечитывается на каждом создании инстанса. Делать для этого ничего не нужно.

**А вот что нужно:** ходить через роутер. Переключатель языка, присваивающий
`window.location.href`, делает жёсткую навигацию в обход роутера — страница перезагружается, состояние теряется, и любой
тест поверх этого меряет не то.

```ts
import {navigate} from 'astro:transitions/client'

watch(selected, (value) => {
    const next = links.find(link => link.value === value)
    if (next)
        void navigate(next.href)
})
```

Подробности и способы отказа — в [Теме](./theme.ru.md#клиентская-навигация) и
[Строках](./i18n.ru.md#клиентская-навигация).

---

## 6. Серверный рендеринг

По умолчанию Astro отрисовывает каждую страницу один раз, на сборке, и отдаёт готовые
HTML-файлы. Серверный рендеринг делает это на каждый запрос — а он нужен там, где
страница зависит от того, кто спрашивает: личный кабинет, персональная лента, всё, что
читает куку или живую базу.

Astro требует для этого двух вещей: `output: 'server'` и **адаптер** — пакет, который
учит Astro работать на конкретном хостинге. `@astrojs/node` для своего сервера или
контейнера, `@astrojs/vercel`, `@astrojs/netlify`, `@astrojs/cloudflare` — для этих
платформ. Без адаптера `output: 'server'` роняет сборку: Astro не знает, в какой среде
исполнения его разворачивают.

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

**Одна возможность выключается сама: строки в HTML.** Состояние страницы, из которого
собирается снимок, лежит в модульной переменной, а сервер обрабатывает запросы
параллельно в одном процессе — `beginPage` одного запроса затёр бы состояние другого, и
страница могла бы уехать с чужим языком. Интеграция распознаёт `output: 'server'` и
отказывается, печатая предупреждение с починкой вместо того, чтобы отгрузить гонку.

`ssrStrings: false` подтверждает решение и убирает предупреждение. Переводы после этого
приезжают обычным путём — клиент догружает чанк словаря после гидратации, ровно как до
появления этой возможности.

Отказ грубый, а не умный: страницы, помеченные `prerender = true`, отрисовываются на
сборке и были бы безопасны, но отличить их в `astro:config:setup` нечем, поэтому
безопасное поведение выбирается для всех.

**Всё остальное не затронуто**: скрипт темы, авто-импорт, проверка окружения и все
компоненты ведут себя точно так же.
