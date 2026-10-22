# @feugene/astro-granularity

[English](./README.md) · **Русский**

Интеграция [Astro](https://astro.build) для дизайн-системы
[`@feugene/granularity`](https://github.com/efureev/granularity).

Одна строка в `astro.config.mjs` — и библиотека подключена: режим ставится **до первой отрисовки**, строки компонентов
приезжают внутри HTML, регистрируется авто-импорт, а неверно собранное окружение роняет сборку сообщением, которое
называет починку, вместо того чтобы молча отдать бесцветную страницу.

Требуются **Astro 7**, `@feugene/granularity` **3** — не ниже 3.1.1 — и `@feugene/granum` **3** — не ниже 3.10.

## Что она делает

Четыре отдельные вещи, каждая выключается флагом. Интеграция, которую нельзя частично отключить, становится препятствием
на первом же проекте, не совпавшем с её допущениями.

|                        | Что                                                                                                               | Выключить                  |
|------------------------|-------------------------------------------------------------------------------------------------------------------|----------------------------|
| **Режим без мигания**  | Синхронный инлайн-скрипт в `<head>` ставит пару режима из манифеста сборки так же, как контроллер, на котором стоит `useTheme` ядра, и переживает клиентскую навигацию | `injectThemeScript: false` |
| **Строки в HTML**      | Middleware сообщает язык маршрута до рендера и кладёт снимок переводов в `<head>`                                 | `i18n.ssrStrings: false`   |
| **Авто-импорт**        | Регистрирует резолвер `unplugin-vue-components` для ядра и всех спутников из вашего `package.json`: `<GrButton>` в `.vue` не требует импорта | `resolver: false`          |
| **Проверка окружения** | Роняет сборку, если нет `@astrojs/vue` или плагина `granum`, называя точную строку-починку, или если granum слишком старый, чтобы отдать манифест режимов | `strict: false`            |

Чужой конфиг она **не правит**. Нет плагина `granum` в `vite.plugins` или `@astrojs/vue` в `integrations` — будет
внятная ошибка, а не тихая подстановка: конфиг, который читается одним, а собирается другим, ищут днями.

CSS-конвейер остаётся вашим: `granum` — обычный плагин Vite, его регистрируете вы и его стиль импортируете тоже вы.
Интеграция знает про плагин две вещи: его имя и его `api.themeManifest` — режимы сборки с их парами. Сам скрипт режима
пишет генератор granum из `@feugene/granum/runtime`. Версию задаёт дизайн-система: ядро 3 стоит на `granum` 3.10 —
значения тем у самой темы, — и интеграция объявляет 3.10 и новее.

## Установка

`@floating-ui/dom` — обязательный peer ядра: без него сборка падает на первом же компоненте со всплывающей панелью.

```bash
# yarn
yarn add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom @feugene/fint-i18n @feugene/granum @feugene/granum-engine-wind
# npm
npm i -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom @feugene/fint-i18n @feugene/granum @feugene/granum-engine-wind
# pnpm
pnpm add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom @feugene/fint-i18n @feugene/granum @feugene/granum-engine-wind
```

`@feugene/granum` собирает CSS и отдаёт интеграции манифест режимов, `@feugene/granum-engine-wind` — движок утилит, на
котором он работает. Движок нужен только на сборке, а из granum в браузер может уехать лишь контроллер режимов,
`@feugene/granum/runtime`, — и только если его импортирует ваш переключатель.

`@feugene/fint-i18n` везёт строки: на нём построен `@feugene/astro-granularity/app` из быстрого старта ниже. Это
опциональный peer, и сам его не поставит ни один менеджер пакетов; без него `astro build` падает с `MISSING_EXPORT` на
`createFintI18n`. Приложению со своим i18n-рантаймом не нужны ни он, ни `./app` — см.
[рецепт 3](./docs/recipes.ru.md#3-свой-i18n-рантайм).

## Быстрый старт

```js
// astro.config.mjs
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import {granum} from '@feugene/granum/vite'
import {defineConfig} from 'astro/config'
import granumConfig from './granum.config.mjs'

export default defineConfig({
    integrations: [
        vue({appEntrypoint: '@feugene/astro-granularity/app'}),
        granularity({i18n: {locales: ['en', 'ru']}}),
    ],
    vite: {plugins: [granum(granumConfig)]},
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'ru'],
        routing: {prefixDefaultLocale: false},
    },
})
```

```js
// granum.config.mjs
import {windEngine} from '@feugene/granum-engine-wind'
import {defineGranumConfig} from '@feugene/granum/vite'

export default defineGranumConfig({
    engine: windEngine(),
    providers: ['@feugene/granularity'],
    components: [{provider: '@feugene/granularity', names: ['GrButton', 'GrCard']}],
    themes: [{theme: 'slate', modes: ['light', 'dark']}],
    // Свои исходники — с диска. Утилита, встречающаяся только внутри острова
    // `client:only`, доезжает до CSS без единой дополнительной настройки.
    appSources: {dirs: ['src']},
})
```

```astro
---
// src/layouts/BaseLayout.astro — порядок этих трёх строк несущий
import '../styles/reset.css'   // @import '@unocss/reset/tailwind-compat.css' layer(reset);
import 'virtual:granum.css'    // пять каскадных слоёв granum.*
import '../styles/theme.css'   // своё, вне слоёв — и потому побеждает
---
```

**Порядок импортов CSS решает каскад.** Нелейерный CSS бьёт любой `@layer` независимо от специфичности, поэтому сброс
браузерных стилей обязан лежать в слое, объявленном *до* слоёв granum, — иначе `button { color: inherit; padding: 0 }`
из сброса перебьёт утилиты компонента, молча и без предупреждения.

## Документация

|                                             |                                                                  |
|---------------------------------------------|------------------------------------------------------------------|
| [Рецепты](./docs/recipes.ru.md)             | Шесть способов подключения — от двух компонентов до серверного рендеринга    |
| [Тема](./docs/theme.ru.md)                  | Откуда берутся пары режимов, контракт из двух точек, свой переключатель, клиентская навигация |
| [Строки](./docs/i18n.ru.md)                 | Как переводы попадают в HTML, режимы снимка, свой i18n-рантайм   |
| [Острова](./docs/islands.ru.md)             | Директивы гидратации, оверлеи, `client:only`, общее состояние    |
| [Справочник](./docs/reference.ru.md)        | Все опции, экспорты, подпути и peer-диапазоны                    |
| [Диагностика](./docs/troubleshooting.ru.md) | Симптом → причина → починка                                      |

## Примеры

В `examples/` — одно и то же приложение во всех трёх режимах вывода Astro: `static`, `ssr` и `hybrid`. Именно одно, а не
три: лейауты, компоненты, стили, данные и строки лежат в `examples/shared`, а стенду принадлежат только его
`astro.config.mjs`, `granum.config.mjs` и тонкие обёртки маршрутов.

В этом и смысл. Раз UI общий, расхождение между стендами не может быть разницей приложений — это всегда режим вывода, и
браузерный гейт сверяет все три пиксель в пиксель на каждом прогоне.

Само приложение — панель состояния сервисов: три раздела на трёх языках, 22 страницы. Шапка и подвал островами; на
каждой странице по одному острову, отрисованному на сервере, и одному клиентскому. Lighthouse даёт **100 по доступности,
лучшим практикам и SEO** и 99–100 по производительности. Числа, условия замера и то, что меняет каждый режим, — в
[`examples/README.md`](./examples/README.md).

## Лицензия

См. [LICENSE](./LICENSE).
