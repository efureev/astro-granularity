# Recipes

**English** · [Русский](./recipes.ru.md)

Nine ways to wire this integration up. They differ in which parts are switched on, not
in style — pick the one whose constraints match yours.

| # | Recipe | Vue | Strings | UnoCSS |
| --- | --- | --- | --- | --- |
| [1](#1-the-theme-alone) | The theme alone | — | — | optional |
| [2](#2-the-full-setup) | The full setup | ✓ | ✓ | ✓ |
| [3](#3-one-or-two-components) | One or two components | ✓ | ✓ | ✓ |
| [4](#4-everything-the-provider-has) | Everything the provider has | ✓ | ✓ | ✓ |
| [5](#5-tokens-without-components) | Tokens without components | — | — | — |
| [6](#6-your-own-i18n-runtime) | Your own i18n runtime | ✓ | your own | ✓ |
| [7](#7-with-satellite-packages) | With satellite packages | ✓ | ✓ | ✓ |
| [8](#8-multilingual-with-clientrouter) | Multilingual + `ClientRouter` | ✓ | ✓ | ✓ |
| [9](#9-ssr-behind-an-adapter) | SSR behind an adapter | ✓ | partly | ✓ |

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

## 3. One or two components

This is what the design system is built around, and the recipe most projects should
start from. You name the components you actually put in the markup; the preset works
out the rest.

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

`astro.config.mjs` is the one from recipe 2 — the integration reads nothing from this
list. Selection lives entirely in the UnoCSS config.

**What the selection costs.** Generated CSS, measured on this repository with
`@feugene/granularity@0.36.0` and the preset at `0.13.0`:

| Selection | CSS | Library files scanned |
| --- | --- | --- |
| `GrButton` | 44 713 B | 2 |
| `GrButton`, `GrCard` | 45 695 B | 4 |
| Five, as in `example/` | 66 778 B | 20 |
| `'all'` | 113 996 B | 158 |

Read the first row as the floor: roughly 44 KB is tokens, both themes, the base layer
and preflights, and it is there no matter how little you select. The second component
adds about 1 KB. That shape is the point — the price of the design system is paid once,
and components are cheap after it.

**Transitive dependencies come along by themselves.** Listing `GrDialog` brings
`GrModal`; `GrSelect` brings the chips it renders. You list what you write, not what
those components happen to need — that graph is the provider's business, not yours.

**The qualified form is the safe one.** `{ provider, names }` says which provider a name
belongs to; a bare string is only allowed inside a component's own `dependencies`. With
one provider both work, but the qualified form does not change meaning when a second
provider arrives.

**A name that does not exist fails the build**, and the error lists what the provider
does have:

```
ComponentNotFoundError: Component '@feugene/granularity:GrButtn' not found.
Available in '@feugene/granularity': [GrAlert, GrAutocomplete, …]
```

**Adding a component to markup without adding it here gives you an unstyled one** — no
colour, no spacing, no size. Nothing fails; the page just looks wrong. If that is the
symptom you have, this list is the first place to look.

The preset ships a CLI for exactly these questions:

```bash
npx granular explain ./granular.options.mjs '@feugene/granularity:GrModal'  # why is it in the build
npx granular why-css ./granular.options.mjs 'rounded-lg'                    # who pulled this class
npx granular doctor  ./granular.options.mjs                                 # the whole configuration
```

It reads a plain module exporting the options, so extract them out of `uno.config.ts`
into `granular.options.mjs` and import them back — otherwise there is nothing to hand it.

---

## 4. Everything the provider has

```ts
const options = {
  providers: [provider],
  components: 'all',
  themes: { names: ['light', 'dark'] },
}
```

All 78 components of the core, and 113 996 B of CSS against 45 695 B for two — every
byte of it blocking the first paint, because this is the document's stylesheet.

**Worth it when the set of components genuinely is not known ahead of time**: an admin
panel assembled from a schema, a page builder, a documentation site rendering arbitrary
demos. There the alternative is not a smaller list — it is a list that goes stale
silently, and a component that renders unstyled in production.

**Not worth it as a way to skip writing the list.** A site with a known set of pages
knows its components; `'all'` there buys a 68 KB blocking stylesheet in exchange for not
editing one array.

Scanning grows too: 158 library files against 4. That is build time, not runtime, but it
is not free either.

---

## 5. Tokens without components

**The components of this design system require UnoCSS.** There is no configuration that
changes it, and this recipe does not offer one.

Their markup carries utility classes — 114 distinct ones across the shipped bundles,
`inline-flex`, `gap-2`, `h-4 w-4 animate-spin`, `absolute`, `rounded-lg` and the rest —
and something has to turn those into CSS. The preset is that something. The integration
says so itself when the preset is missing: *"классы из SFC библиотеки не попадут в
вывод, и компоненты отрисуются без цвета, отступов и размеров."*

`@feugene/granularity/styles.css` does **not** cover them. It carries both themes,
`tokens.css`, `base.css` and preflights — custom properties and element-level rules.
Measured against the 114: **it defines none of them.** A `GrButton` under that bundle
alone gets its colours from `--gr-*` and nothing else — no layout, no size, no radius.

What the bundle is actually for is the other direction: **your own markup on the design
system's tokens.**

```js
integrations: [
  granularity({
    injectStyleBundle: true,   // themes, tokens, base layer, preflights
    resolver: false,           // no components to auto-import
    strict: false,             // the preset check would fail, correctly
  }),
]
```

You get `--gr-bg`, `--gr-fg`, `--gr-primary`, the spacing and radius scales, both themes
and the theme switch — one shared visual language across projects, styled however you
like. You do not get a single component.

**Never turn `injectStyleBundle` on next to a working `presetGranularNode`.** The preset
already emits the themes and tokens as preflights; the bundle would ship a second copy
of every one of them.

`strict: false` is required and is not a workaround. The environment check looks for a
preset named `granular-preset` and for `@astrojs/vue`; neither is here on purpose, and
at the default `strict: true` the build stops on an error that is right about every
other setup.

Be ready for the log: `strict: false` downgrades those errors from a thrown exception to
`logger.error`, it does not silence them. The build completes and both messages are
printed on every run. There is no option that turns the checks off — this recipe is the
one place where they cry wolf, and the noise is the price of them being reliable
everywhere else.

---

## 6. Your own i18n runtime

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

## 7. With satellite packages

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

## 8. Multilingual with `ClientRouter`

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

## 9. SSR behind an adapter

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
