# Recipes

**English** · [Русский](./recipes.ru.md)

Seven ways to wire this integration up. They differ in which parts are switched on, not
in style — pick the one whose constraints match yours.

| # | Recipe | Vue | Strings | UnoCSS |
| --- | --- | --- | --- | --- |
| [1](#1-the-theme-alone) | The theme alone | — | — | optional |
| [2](#2-the-full-setup) | The full setup | ✓ | ✓ | ✓ |
| [3](#3-without-unocss) | Without UnoCSS | ✓ | ✓ | — |
| [4](#4-your-own-i18n-runtime) | Your own i18n runtime | ✓ | your own | ✓ |
| [5](#5-with-satellite-packages) | With satellite packages | ✓ | ✓ | ✓ |
| [6](#6-multilingual-with-clientrouter) | Multilingual + `ClientRouter` | ✓ | ✓ | ✓ |
| [7](#7-ssr-behind-an-adapter) | SSR behind an adapter | ✓ | partly | ✓ |

---

## 1. The theme alone

You want a flash-free dark mode and nothing else. No Vue islands, no component
translations, possibly no design-system components at all.

```js
// astro.config.mjs
import granularity from '@feugene/astro-granularity'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    granularity({
      i18n: false,      // no virtual loader module at all
      resolver: false,  // nothing to auto-import without Vue
      strict: false,    // do not demand @astrojs/vue and the UnoCSS preset
    }),
  ],
})
```

**What you get.** One synchronous inline script in `<head>`, about 370 bytes. It reads
the stored choice, falls back to `prefers-color-scheme`, writes `data-theme` and
`color-scheme` on `<html>`, and re-applies itself after a client-side navigation.

**What you must supply.** Something that *writes* the theme — see
[Theme](./theme.md#writing-your-own-toggle). And CSS that reacts to `data-theme`; the
design system's own tokens do, if you load them.

**Why `strict: false`.** The environment check exists to catch a half-configured Vue +
UnoCSS setup. Here there is nothing to check, and leaving it on would fail the build over
an absence you chose deliberately.

---

## 2. The full setup

The default, and where most projects start. Vue islands, component strings in the HTML,
auto-import, environment checks.

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

Three things here are load-bearing and easy to drop:

1. **`appEntrypoint`** — without it no i18n instance is ever created, and components fall
   back to their literal English labels.
2. **The `i18n` block in Astro's own config** — without it `Astro.currentLocale` is
   `undefined`, and the route language has to be guessed from the first path segment. See
   [Strings](./i18n.md#where-the-route-language-comes-from).
3. **`site`** — needed for canonical URLs, `hreflang` and a sitemap. Not needed by the
   integration itself, but you will want it.

`uno.config.ts` is in the [README](../README.md#quick-start).

---

## 3. Without UnoCSS

A project that already has its own styling pipeline and does not want a second one.

```js
integrations: [
  vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
  granularity({
    injectStyleBundle: true,  // pull @feugene/granularity/styles.css
    strict: false,            // the preset check would fail — there is no preset
    i18n: { locales: ['en', 'ru'] },
  }),
]
```

**What you lose.** The utility classes the preset generates for components. The bundle
carries tokens, themes, the base layer and preflights — not the per-component utilities.
Components will be styled but some layout classes the design system's own markup uses
will be missing.

**Never turn `injectStyleBundle` on together with a working `presetGranularNode`.** The
preset already emits tokens and both themes as preflights; the bundle would duplicate
every one of them.

---

## 4. Your own i18n runtime

The loader format the ecosystem publishes is `fint-i18n`, so the bundled `./app`
entrypoint wires that. An application with a different runtime does not need it.

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

The core asks an adapter for `t` and, if it has one, `te`. By default the adapter is also
provided under the `fint-i18n` key: ecosystem packages that have not moved to the core
composable look for the instance only there, and without it they silently show the
English fallback. Pass `{ alsoFintKey: false }` if your application calls `installI18n`
itself — otherwise two providers fight over one key and the last one wins.

**The strings snapshot is yours to wire.** `readServerPageLocale()` and
`readSnapshotFromDocument()` are exported from `./runtime`, but with `i18n: false` no
middleware is registered and no snapshot is produced. Building one is your job — see
[Strings](./i18n.md#the-seam-for-your-own-runtime).

---

## 5. With satellite packages

Beyond the core, the ecosystem ships packages with their own components and their own
string blocks.

```js
granularity({
  i18n: {
    packages: ['@feugene/granularity-chrono'],
    locales: ['en', 'ru', 'es'],
  },
})
```

```ts
// uno.config.ts — the satellite needs its provider too
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

**Block names are not listed anywhere.** `deriveI18nBlocks` reads them out of the loader
collections, where they sit as the second key level. This matters because a block name is
not derivable from a package name — `granularity-forms-schema` declares `grForms`.

The component list takes the **qualified** form (`{ provider, names }`): a bare name is
only allowed inside a component's own `dependencies`. Transitive dependencies are
resolved by the preset, so listing `GrDialog` brings `GrModal` with it.

---

## 6. Multilingual with `ClientRouter`

`ClientRouter` swaps the document without re-executing modules, and everything living
outside the markup is reset by that.

```js
// astro.config.mjs — as in recipe 2, plus three locales
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

The integration handles both halves of what the swap breaks: the theme script
re-subscribes via `astro:after-swap`, and the strings snapshot is re-read on every
instance creation. You do not have to do anything for either.

**What you do have to do:** navigate through the router. A language switcher that assigns
`window.location.href` performs a hard navigation, bypassing the router entirely — the
page reloads, state is lost, and any test you write against it measures the wrong thing.

```ts
import { navigate } from 'astro:transitions/client'

watch(selected, (value) => {
  const next = links.find(link => link.value === value)
  if (next)
    void navigate(next.href)
})
```

Details and the failure modes are in [Theme](./theme.md#client-side-navigation) and
[Strings](./i18n.md#client-side-navigation).

---

## 7. SSR behind an adapter

Everything works except one thing, and that one thing switches itself off.

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
        ssrStrings: false,  // silences the warning below
      },
    }),
  ],
})
```

**Strings in the HTML are unavailable under `output: 'server'`.** The page state the
snapshot is built from is a module-level variable, and requests are handled concurrently
in one process: one request's `beginPage` would overwrite another's, and a page could be
served with a neighbour's language. The integration detects this and refuses, printing a
warning with the fix rather than shipping the race.

Setting `ssrStrings: false` acknowledges the decision and removes the warning.
Translations then arrive the ordinary way — the client fetches the dictionary chunk after
hydration, exactly as it did before this feature existed.

The trade-off is honest rather than complete: pages you mark `prerender = true` would be
safe, but nothing in `astro:config:setup` can tell them apart, so the safe behaviour is
chosen for all of them.

**Everything else is unaffected**: the theme script, auto-import, the environment check
and every component behave identically.
