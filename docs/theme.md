# Theme

**English** · [Русский](./theme.ru.md)

## Why an inline script at all

The theme is chosen at build time, the mode at run time. The core switches modes by one
attribute on `<html>` — a **pair** of the build's theme and the mode,
`data-theme="slate-dark"`. On a static build the HTML is identical for every visitor, so
the pair can only be set by code running in the browser — and it has to run **before the
first paint**. Anything deferred, bundled or module-scoped is too late: the page renders
light, then repaints in front of the reader.

The integration emits a synchronous inline `<script>` into `<head>`. About 400 bytes, no
`src`, no `defer`, no `async`. All three properties are load-bearing and all three are
held by a gate that records the actual paint frames over CDP — a screenshot taken after
`load` would show the settled mode and miss the flash entirely.

The code is written by granum itself (`createThemeScriptCode` from
`@feugene/granum/runtime`), so it picks the mode by the same rule as the granum controller
the core `useTheme` stands on — the script and the runtime cannot disagree:

1. a pair already on `<html>` stays — the server put it there;
2. otherwise the cookie, when `themeCookie` is set;
3. otherwise the mode name in `localStorage`;
4. otherwise the system scheme: the first mode whose `colorScheme` matches
   `prefers-color-scheme`;
5. otherwise the theme's default mode.

The code is generated for your build: the pairs and the system-scheme choice are baked in
as constants, and the cookie branch exists only when `themeCookie` is set. What Astro
needs on top — a re-run after a client-side navigation — is granum's `reapplyOn` option
too; the integration only names the event, `astro:after-swap`.

## Where the pairs come from

From the granum build, never from your hands. The modes, their pairs and the attribute
are decided by `granum.config` — `theme: 'slate'` with `modes: { names: ['light',
'dark'] }` gives `slate-light` and `slate-dark`. The integration asks the granum plugin
in `vite.plugins` for them (`api.themeManifest`) during `astro:config:setup`. It is the
same config the CSS is built from, so the script cannot set a pair the stylesheet does
not have.

That timing has two consequences:

- **`granum(granumConfig)` has to sit directly in `vite.plugins` of the Astro config.**
  A plugin that another integration adds later is not there yet when the script is
  built: the CSS arrives, the script does not, and the build warns with
  `theme-script-skipped`.
- **granum has to be 3.2 or newer.** A plugin that does not hand the manifest out before
  the build — no `api.themeManifest` — fails the build with
  `granum-without-theme-manifest`, logged as an error under `strict: false`, because
  without pairs the first frame flashes.

A build without modes gets no script at all: there is no pair to set.

## The contract has two points

Whoever *writes* the mode has to agree with the script that *reads* it:

```js
localStorage.getItem('gr-theme')                     // 'dark' — the mode name; key = `themeStorageKey`
document.documentElement.getAttribute('data-theme')  // 'slate-dark' — the pair from the build manifest
```

The name is stored rather than the pair, so a choice survives a change of theme in the
build. `color-scheme` is no longer part of the contract: the mode's CSS declares it —
`[data-theme="slate-dark"] { color-scheme: dark }` — because an inline style would outlive
a mode switched at run time by `useTheme`, which only writes the attribute.

Write both through granum's controller and the contract holds by construction — see
below. Miss a point by hand and the failure is silent:

| Missed | What happens |
| --- | --- |
| The key — say, granum's own default `granum-theme` | The choice does not survive a reload: the script finds nothing under `gr-theme` and follows the system scheme |
| The pair stored instead of the name | The same: `slate-dark` is not a mode, and the script skips it |
| The mode name on `<html>` — `data-theme="dark"` | It matches no selector: components stay in the default mode, and so does `color-scheme` |
| A pair typed by hand | Works until the theme in `granum.config` changes, then silently matches nothing |
| `data-theme` hard-coded in the layout | The script takes it for the server's pair and keeps it: neither the stored choice nor the system scheme ever applies |

Your own CSS should not depend on the theme's name either. In this order: colours from the
`--gr-*` roles need no selector at all; `dark:` utilities in markup follow every dark-scheme mode of
the build; `light-dark(light, dark)` picks a colour by the mode's `color-scheme`; for what is not a
colour, the pair's suffix `[data-theme$='-dark']` — never `[data-theme='dark']`. The full order and
the trap of nested islands are in
[`modes.md`](https://github.com/efureev/granularity/blob/main/packages/granularity/docs/modes.md#свой-css-под-режим)
of the core; the example's `styles/theme.css` follows it.

## Writing your own toggle

The package ships the reader half only. A mode switch is application markup, and Vue is
not worth booting for one button — a `<button>`, one delegated listener and granum's
controller over the build manifest are the whole implementation.

```astro
---
interface Props { class?: string }
const { class: className } = Astro.props
---

<button type="button" class={className} data-theme-toggle>
  <slot />
</button>

<script>
  import { createCookieStorage, createThemeController } from '@feugene/granum/runtime'
  import manifest from 'virtual:granum/themes'
  import { cookie, storageKey } from 'virtual:granularity/theme'

  function toggle() {
    // A controller per click, not per module: `ClientRouter` swaps the document
    // without re-running this module, and a fresh controller reads the mode off the pair.
    // Key and cookie come from the integration — the same ones the script reads.
    const themes = createThemeController(manifest, cookie
      ? { storage: createCookieStorage({ name: cookie }) }
      : { storageKey })
    const scheme = themes.modes().find(mode => mode.name === themes.mode)?.colorScheme
    const next = themes.modes().find(mode => mode.colorScheme !== scheme)
    if (next)
      themes.setMode(next.name)
  }

  // Delegation, not a listener on the button: buttons can arrive later — from an
  // island, from a `ClientRouter` swap, from an inserted fragment.
  document.addEventListener('click', (event) => {
    if ((event.target as Element | null)?.closest('[data-theme-toggle]'))
      toggle()
  })
</script>
```

`setMode` sets the pair and stores the name. The write that throws in Safari private mode
is caught inside: the mode switches, it simply does not survive a reload. With more than
two modes, `themes.cycle()` walks them in manifest order, and `themes.modes()` is ready to
feed a menu.

`virtual:granularity/theme` carries the integration's `themeStorageKey` and `themeCookie`, so
the toggle cannot drift from the script that reads them. The types of `virtual:granum/themes`
come from granum, those of `virtual:granularity/theme` from this package — two lines in
`src/env.d.ts`:

```ts
/// <reference types="@feugene/granum/client" />
/// <reference types="@feugene/astro-granularity/client" />
```

A working version, including accessible-name handling, lives in
[`examples/shared/src/components/ThemeToggle.astro`](../examples/shared/src/components/ThemeToggle.astro).

### The accessible name describes the result

"Switch to dark theme" on a light page, and the reverse. `aria-pressed` only confuses
here — it is not obvious what would count as pressed. The name has to be updated when the
mode changes, and re-applied after a `ClientRouter` swap replaces the markup.

### Inside a Vue island

The core `useTheme()` stands on the same controller, key and pair, so a toggle in an
island and one in Astro markup stay in step. The `@feugene/astro-granularity/app` entry hands it
the build's manifest: in the browser once per page, as one state shared by every island (a mode
switched in one reaches the rest), with the `themeStorageKey` key and the `themeCookie` cookie; on
the server as the island's own state without storage, so that one page's mode does not leak into
another. An entry of your own does the same itself — how is in the core's
[mode guide](https://github.com/efureev/granularity/blob/main/packages/granularity/docs/modes.md):
without a manifest the core assumes `slate` with `light` and `dark`.

## Client-side navigation

`ClientRouter` strips **every** attribute off `<html>` and copies them from the fetched
document:

```js
// astro/dist/transitions/swap-functions.js
const nonOverridableAstroAttributes = [...currentRoot.attributes].filter(
  ({ name }) => (currentRoot.removeAttribute(name), NON_OVERRIDABLE_ASTRO_ATTRS.includes(name))
)
```

The fetched document is parsed, not executed, so unless a server put the pair into it,
it carries no `data-theme` — the inline script never ran on it. Without a subscription
the mode is therefore lost on every client-side navigation.

The script handles this itself: granum generates it with
`reapplyOn: ['astro:after-swap']`, which subscribes the apply step to that event. It takes
the same path as on the first load, so a pair that came with the server's HTML is left
alone. Two details in that subscription matter.

**On `document`, not `window`, and only once.** Astro dispatches
`document.dispatchEvent(new Event(name))`, and such an event does not bubble.

**Inside a `try`.** An exception in `<head>` halts document parsing, so the generated
code never throws out of itself — including when `document` is somehow absent.

## The budget is a gate

512 bytes on a theme with two modes, held by a unit test of the package and by the
browser gate. The script blocks the first paint by definition, so it grows on the owner's
decision, not as a side effect of an edit. Currently 407 bytes on `slate` with two modes,
and 497 with `themeCookie`.

In your build the size also depends on how many modes there are: each one brings its
name and its pair. Past the budget your build gets a warning, not an error — whether a
mode is worth its bytes is your decision, not the integration's.

## Options

| Option | Default | Note |
| --- | --- | --- |
| `themeStorageKey` | `'gr-theme'` | Where the mode name is stored. Equals the core's `GR_THEME_STORAGE_KEY`; change it and every writer — `useTheme`, your toggle — must change with it |
| `themeCookie` | — | A cookie holding the mode name, for SSR with granum's `createCookieStorage`. The script reads it before `localStorage`. See [recipe 6](./recipes.md#6-server-side-rendering) |
| `injectThemeScript` | `true` | Turn off when the application sets the pair itself, earlier |

There is no `defaultTheme`: the default mode belongs to the theme in `granum.config`, and
without a stored choice the script follows the system scheme. Passing it from JavaScript
throws a `TypeError` that says so instead of being silently ignored.
