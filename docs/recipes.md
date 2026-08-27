# Recipes

**English** · [Русский](./recipes.ru.md)

Six ways to wire this integration up. They differ in which parts are switched on, not in
style — pick the one whose constraints match yours.

| # | Recipe | Vue | Strings | UnoCSS |
| --- | --- | --- | --- | --- |
| [1](#1-per-component-install) | Per-component install | ✓ | ✓ | ✓ |
| [2](#2-installing-every-component) | Installing every component | ✓ | ✓ | ✓ |
| [3](#3-your-own-i18n-runtime) | Your own i18n runtime | ✓ | your own | ✓ |
| [4](#4-with-satellite-packages) | With satellite packages | ✓ | ✓ | ✓ |
| [5](#5-multilingual-with-clientrouter) | Multilingual + `ClientRouter` | ✓ | ✓ | ✓ |
| [6](#6-server-side-rendering) | Server-side rendering | ✓ | no | ✓ |

---

## 1. Per-component install

The recipe to start from, and the one this design system is built around. You name the
components you actually put in the markup; everything else follows from that list.

Two files, and both matter — the integration and the stylesheet are configured
separately.

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

That is the whole setup: Vue islands, component strings in the HTML, auto-import,
environment checks, and exactly two components' worth of CSS.

### Three things that are easy to drop and expensive to miss

1. **`appEntrypoint`** — without it no i18n instance is ever created, and components fall
   back to their literal English labels.
2. **The `i18n` block in Astro's own config** — without it `Astro.currentLocale` is
   `undefined`, and the route language has to be guessed from the first path segment. See
   [Strings](./i18n.md#where-the-route-language-comes-from).
3. **`site`** — needed for canonical URLs, `hreflang` and a sitemap. The integration does
   not read it, but you will want it.

The integration reads nothing from the component list; selection lives entirely in
`uno.config.ts`. The same `options` object must go into both `presetGranularNode` and
`granularContent` — the first decides what to emit, the second what to scan, and if they
drift apart components arrive unstyled.

### What the selection costs

Generated CSS, measured on this repository with `@feugene/granularity@0.36.0` and the
preset at `0.13.0`:

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

### Working with the list

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

## 2. Installing every component

`astro.config.mjs` is unchanged from recipe 1 — only the selection differs.

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

## 3. Your own i18n runtime

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

## 4. With satellite packages

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

## 5. Multilingual with `ClientRouter`

`ClientRouter` swaps the document without re-executing modules, and everything living
outside the markup is reset by that.

```js
// astro.config.mjs — as in recipe 1, plus three locales
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

## 6. Server-side rendering

By default Astro renders every page once, at build time, and serves the resulting HTML
files. Server-side rendering does it per request instead — which is what you need for
pages that depend on who is asking: a signed-in dashboard, a personalised feed, anything
reading a cookie or a live database.

Astro needs two things for that. `output: 'server'`, and an **adapter** — the package
that teaches Astro to run on your particular host. `@astrojs/node` for your own server or
a container, `@astrojs/vercel`, `@astrojs/netlify`, `@astrojs/cloudflare` for those
platforms. Without an adapter `output: 'server'` fails the build; Astro does not know
what runtime it is being deployed to.

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

**One feature switches itself off: strings in the HTML.** The page state the snapshot is
built from is a module-level variable, and a server handles requests concurrently in one
process — one request's `beginPage` would overwrite another's, and a page could be served
with a neighbour's language. The integration detects `output: 'server'` and refuses,
printing a warning with the fix rather than shipping the race.

Setting `ssrStrings: false` acknowledges the decision and removes the warning.
Translations then arrive the ordinary way — the client fetches the dictionary chunk after
hydration, exactly as it did before that feature existed.

The refusal is blunt rather than clever: pages you mark `prerender = true` are rendered
at build time and would be safe, but nothing in `astro:config:setup` can tell them apart
from the rest, so the safe behaviour is chosen for all of them.

**Everything else is unaffected**: the theme script, auto-import, the environment check
and every component behave identically.
