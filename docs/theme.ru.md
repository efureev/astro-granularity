# Тема

[English](./theme.md) · **Русский**

## Зачем вообще инлайн-скрипт

На статической сборке HTML одинаков для всех посетителей, поэтому `data-theme` может
поставить только код в браузере — и поставить он обязан **до первой отрисовки**. Всё
отложенное, собранное в бандл или живущее на уровне модуля опаздывает: страница
отрисуется светлой и перекрасится на глазах у читателя.

Интеграция вставляет синхронный инлайн-`<script>` в `<head>`. Около 370 байт, без `src`,
без `defer`, без `async`. Все три свойства несущие, и все три держит гейт, снимающий
настоящие кадры отрисовки через CDP: скриншот после `load` показал бы установившуюся тему
и мигание пропустил.

Скрипт разрешает тему ровно так же, как `useTheme` ядра: сохранённый выбор →
`prefers-color-scheme` → `defaultTheme`.

## Контракт из трёх точек

Тот, кто тему **пишет**, обязан совпасть со скриптом, который её **читает**. Промах в
любой из трёх — и отказ будет молчаливым:

```js
localStorage.setItem('gr-theme', theme)          // ключ = опция `themeStorageKey`
document.documentElement.dataset.theme = theme   // 'light' | 'dark'
document.documentElement.style.colorScheme = theme
```

| Промах | Что произойдёт |
| --- | --- |
| Ключ | Выбор не переживёт перезагрузку |
| `data-theme` | Не изменится вообще ничего |
| `color-scheme` | Нативные скроллбары, `<select>` и поля ввода останутся светлыми на тёмной странице |

Третья строка не косметика, и ядро её не ставит — именно поэтому её ставит интеграция.

## Свой переключатель

Пакет публикует только читающую половину. Переключатель темы — разметка приложения, и Vue
ради одной кнопки поднимать незачем: `<button>` и один делегированный слушатель на
`document` — вся реализация.

```astro
---
interface Props { class?: string }
const { class: className } = Astro.props
---

<button type="button" class={className} data-theme-toggle>
  <slot />
</button>

<script>
  function current(): 'light' | 'dark' {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }

  function apply(theme: 'light' | 'dark') {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    // Бросает в приватном режиме Safari. Тема при этом обязана переключиться —
    // просто не переживёт перезагрузку.
    try {
      localStorage.setItem('gr-theme', theme)
    }
    catch {}
  }

  // Делегирование, а не слушатель на кнопке: кнопки могут приехать позже — из
  // острова, из перехода `ClientRouter`, из вставленного фрагмента.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest('[data-theme-toggle]')
    if (target)
      apply(current() === 'dark' ? 'light' : 'dark')
  })
</script>
```

Рабочая версия, вместе с обработкой доступного имени, — в
[`example/src/components/ThemeToggle.astro`](../example/src/components/ThemeToggle.astro).

### Доступное имя описывает результат

«Включить тёмную тему» на светлой странице, и наоборот. `aria-pressed` здесь только
запутает: непонятно, что считать нажатым. Имя обязано обновляться при смене темы и
применяться заново после того, как подмена `ClientRouter` заменит разметку.

## Клиентская навигация

`ClientRouter` снимает с `<html>` **все** атрибуты и копирует их из полученного документа:

```js
// astro/dist/transitions/swap-functions.js
const nonOverridableAstroAttributes = [...currentRoot.attributes].filter(
  ({ name }) => (currentRoot.removeAttribute(name), NON_OVERRIDABLE_ASTRO_ATTRS.includes(name))
)
```

Полученный документ разбирается, а не исполняется, поэтому `data-theme` в нём нет —
инлайн-скрипт на нём не отрабатывал. Без подписки тема теряется на каждом клиентском
переходе.

Скрипт закрывает это сам: применение вынесено в именованную функцию, подписанную на
`astro:after-swap`. В этой подписке важны две детали.

**На `document`, а не на `window`.** Astro шлёт `document.dispatchEvent(new Event(name))`,
а такое событие не всплывает.

**Под своим `try/catch`.** Исключение в `<head>` останавливает разбор документа, поэтому
скрипт не должен бросать наружу никогда — в том числе когда `document` почему-либо
отсутствует.

## Бюджет — это гейт

512 байт, проверяются на сборке сайта потребителя и в юнит-тесте. Скрипт по определению
блокирует первую отрисовку, поэтому растёт по осознанному решению, а не как побочный
эффект правки. Сейчас — 373 байта при `defaultTheme: 'system'`.

## Опции

| Опция | По умолчанию | Замечание |
| --- | --- | --- |
| `defaultTheme` | `'system'` | `'light'` и `'dark'` убирают ветку `matchMedia`, а с ней и подстроку `prefers-color-scheme`, по которой скрипт ищут некоторые инструменты |
| `themeStorageKey` | `'gr-theme'` | Поменяете — обязаны поменять и все, кто пишет |
| `injectThemeScript` | `true` | Выключить, когда приложение ставит `data-theme` само и раньше |
