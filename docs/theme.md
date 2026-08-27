# Theme

**English** · [Русский](./theme.ru.md)

## Why an inline script at all

On a static build the HTML is identical for every visitor, so `data-theme` can only be
set by code running in the browser — and it has to run **before the first paint**.
Anything deferred, bundled or module-scoped is too late: the page renders light, then
repaints in front of the reader.

The integration emits a synchronous inline `<script>` into `<head>`. Roughly 370 bytes,
no `src`, no `defer`, no `async`. All three properties are load-bearing and all three are
held by a gate that records the actual paint frames over CDP — a screenshot taken after
`load` would show the settled theme and miss the flash entirely.

The script resolves the theme exactly as the core `useTheme` does: stored choice →
`prefers-color-scheme` → `defaultTheme`.

## The contract has three points

Whoever *writes* the theme has to agree with the script that *reads* it. Miss any one and
the failure is silent:

```js
localStorage.setItem('gr-theme', theme)          // key = the `themeStorageKey` option
document.documentElement.dataset.theme = theme   // 'light' | 'dark'
document.documentElement.style.colorScheme = theme
```

| Missed | What happens |
| --- | --- |
| The key | The choice does not survive a reload |
| `data-theme` | Nothing changes at all |
| `color-scheme` | Native scrollbars, `<select>` and inputs stay light on a dark page |

The third is not cosmetic and the core does not set it — that is precisely why the
integration does.

## Writing your own toggle

The package ships the reader half only. A theme switch is application markup, and Vue is
not worth booting for one button — a `<button>` and one delegated listener on `document`
is the whole implementation.

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
    // Throws in Safari private mode. The theme must still switch — it simply
    // will not survive a reload.
    try {
      localStorage.setItem('gr-theme', theme)
    }
    catch {}
  }

  // Delegation, not a listener on the button: buttons can arrive later — from an
  // island, from a `ClientRouter` swap, from an inserted fragment.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest('[data-theme-toggle]')
    if (target)
      apply(current() === 'dark' ? 'light' : 'dark')
  })
</script>
```

A working version, including accessible-name handling, lives in
[`example/src/components/ThemeToggle.astro`](../example/src/components/ThemeToggle.astro).

### The accessible name describes the result

"Switch to dark theme" on a light page, and the reverse. `aria-pressed` only confuses
here — it is not obvious what would count as pressed. The name has to be updated when the
theme changes, and re-applied after a `ClientRouter` swap replaces the markup.

## Client-side navigation

`ClientRouter` strips **every** attribute off `<html>` and copies them from the fetched
document:

```js
// astro/dist/transitions/swap-functions.js
const nonOverridableAstroAttributes = [...currentRoot.attributes].filter(
  ({ name }) => (currentRoot.removeAttribute(name), NON_OVERRIDABLE_ASTRO_ATTRS.includes(name))
)
```

The fetched document is parsed, not executed, so it carries no `data-theme` — the inline
script never ran on it. Without a subscription the theme is therefore lost on every
client-side navigation.

The script handles this itself: the apply step is a named function, subscribed to
`astro:after-swap`. Two details in that subscription matter.

**On `document`, not `window`.** Astro dispatches
`document.dispatchEvent(new Event(name))`, and such an event does not bubble.

**Inside its own `try/catch`.** An exception in `<head>` halts document parsing, so the
script must never throw out of itself — including when `document` is somehow absent.

## The budget is a gate

512 bytes, checked during the consuming site's build and in a unit test. The script
blocks the first paint by definition, so it grows on the owner's decision, not as a side
effect of an edit. Currently 373 bytes with `defaultTheme: 'system'`.

## Options

| Option | Default | Note |
| --- | --- | --- |
| `defaultTheme` | `'system'` | `'light'` and `'dark'` remove the `matchMedia` branch — and with it the `prefers-color-scheme` substring some tooling looks for |
| `themeStorageKey` | `'gr-theme'` | Change it and every writer must change with it |
| `injectThemeScript` | `true` | Turn off when the application sets `data-theme` itself, earlier |
