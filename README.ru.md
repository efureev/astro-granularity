# @feugene/astro-granularity

[English](./README.md) · **Русский**

Интеграция [Astro](https://astro.build) для дизайн-системы
[`@feugene/granularity`](https://github.com/efureev/granularity).

Одна строка в `astro.config.mjs` — и библиотека подключена: тема ставится **до первой
отрисовки**, строки компонентов приезжают внутри HTML, регистрируется авто-импорт, а
неверно собранное окружение роняет сборку сообщением, которое называет починку, вместо
того чтобы молча отдать бесцветную страницу.

Требуется **Astro 7**.

## Что она делает

Четыре отдельные вещи, каждая выключается флагом. Интеграция, которую нельзя частично
отключить, становится препятствием на первом же проекте, не совпавшем с её допущениями.

| | Что | Выключить |
| --- | --- | --- |
| **Тема без мигания** | Синхронный инлайн-скрипт в `<head>` разрешает тему так же, как `useTheme` ядра, и переживает клиентскую навигацию | `injectThemeScript: false` |
| **Строки в HTML** | Middleware сообщает язык маршрута до рендера и кладёт снимок переводов в `<head>` | `i18n.ssrStrings: false` |
| **Авто-импорт** | Регистрирует резолвер `unplugin-vue-components`: `<GrButton>` в `.vue` не требует импорта | `resolver: false` |
| **Проверка окружения** | Роняет сборку, если нет `@astrojs/vue` или пресета UnoCSS, называя точную строку-починку | `strict: false` |

Чужой конфиг она **не правит**. Нет `granular-preset` в `uno.config.ts` или `@astrojs/vue`
в `integrations` — будет внятная ошибка, а не тихая подстановка: конфиг, который читается
одним, а собирается другим, ищут днями.

## Установка

`@floating-ui/dom` — обязательный peer ядра: без него сборка падает на первом же
компоненте со всплывающей панелью.

```bash
# yarn
yarn add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom
# npm
npm i -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom
# pnpm
pnpm add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom
```

## Быстрый старт

```js
// astro.config.mjs
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import { defineConfig } from 'astro/config'
import UnoCSS from 'unocss/astro'

export default defineConfig({
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
import granularityProvider from '@feugene/granularity/granular-provider/node'
import { granularContent, presetGranularNode } from '@feugene/unocss-preset-granular/node'
import { defineConfig, presetMini } from 'unocss'

const options = {
  providers: [granularityProvider],
  components: [{ provider: '@feugene/granularity', names: ['GrButton', 'GrCard'] }],
  themes: { names: ['light', 'dark'] },
  layer: 'granular',
}

const content = granularContent(options)

export default defineConfig({
  content: {
    ...content,
    // Свои исходники — с диска. Без этой строки утилиты, встречающиеся только
    // внутри острова `client:only`, в CSS не попадают вовсе — см. docs/islands.ru.md.
    filesystem: [...(content.filesystem ?? []), 'src/**/*.{vue,astro,ts}'],
  },
  presets: [presetMini(), presetGranularNode(options)],
})
```

Оба вызова получают **один и тот же** объект настроек: первый задаёт, что сканировать,
второй — что эмитить. Разъедутся — компоненты приедут без стилей.

## Документация

| | |
| --- | --- |
| [Рецепты](./docs/recipes.ru.md) | Семь способов подключения — от одной темы до SSR за адаптером |
| [Тема](./docs/theme.ru.md) | Контракт из трёх точек, свой переключатель, клиентская навигация |
| [Строки](./docs/i18n.ru.md) | Как переводы попадают в HTML, режимы снимка, свой i18n-рантайм |
| [Острова](./docs/islands.ru.md) | Директивы гидратации, оверлеи, `client:only`, общее состояние |
| [Справочник](./docs/reference.ru.md) | Все опции, экспорты, подпути и peer-диапазоны |
| [Диагностика](./docs/troubleshooting.ru.md) | Симптом → причина → починка |

## Пример

В `example/` — рабочее приложение на этой интеграции: панель состояния сервисов, три
раздела на трёх языках, 22 страницы. Шапка и подвал островами; на каждой странице по
одному острову, отрисованному на сервере, и одному клиентскому.

Lighthouse даёт **100 по доступности, лучшим практикам и SEO** и 99–100 по
производительности. Числа, условия замера и то, чем они достигнуты, — в
[`example/README.md`](./example/README.md).

## Лицензия

См. [LICENSE](./LICENSE).
