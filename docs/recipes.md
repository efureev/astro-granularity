# Recipes

**English** · [Русский](./recipes.ru.md)

Six ways to wire this integration up. They differ in which parts are switched on, not in
style — pick the one whose constraints match yours.

| # | Recipe | Vue | Strings | granum |
| --- | --- | --- | --- | --- |
| [1](#1-per-component-install) | Per-component install | ✓ | ✓ | ✓ |
| [2](#2-installing-every-component) | Installing every component | ✓ | ✓ | ✓ |
| [3](#3-your-own-i18n-runtime) | Your own i18n runtime | ✓ | your own | ✓ |
| [4](#4-with-satellite-packages) | With satellite packages | ✓ | ✓ | ✓ |
| [5](#5-multilingual-with-clientrouter) | Multilingual + `ClientRouter` | ✓ | ✓ | ✓ |
| [6](#6-server-side-rendering) | Server-side rendering | ✓ | ✓ | ✓ |

---

## 1. Per-component install

The recipe to start from, and the one this design system is built around. You name the
components you actually put in the markup; everything else follows from that list.

Three files, and each matters — the integration, the stylesheet and the layout are
configured separately.

```js
// astro.config.mjs
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import { granum } from '@feugene/granum/vite'
import { defineConfig } from 'astro/config'
import granumConfig from './granum.config.mjs'

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    vue({ appEntrypoint: '@feugene/astro-granularity/app' }),
    granularity({ i18n: { locales: ['en', 'ru'] } }),
  ],
  vite: { plugins: [granum(granumConfig)] },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
    routing: { prefixDefaultLocale: false },
  },
})
```

```js
// granum.config.mjs
import { windEngine } from '@feugene/granum-engine-wind'
import { defineGranumConfig } from '@feugene/granum/vite'

export default defineGranumConfig({
  engine: windEngine(),
  providers: ['@feugene/granularity'],
  components: [
    { provider: '@feugene/granularity', names: ['GrButton', 'GrCard'] },
  ],
  theme: 'slate',
  modes: { names: ['light', 'dark'] },
  appSources: { dirs: ['src'] },
})
```

```astro
---
// src/layouts/BaseLayout.astro — the order of these three is load-bearing
import '../styles/reset.css'   // @import '@unocss/reset/tailwind-compat.css' layer(reset);
import 'virtual:granum.css'    // five cascade layers, granum.*
import '../styles/theme.css'   // your own, unlayered — and therefore the winner
---
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
`granum.config.mjs`. What the integration does check is that the plugin is registered at
all — a missing `granum` in `vite.plugins` fails the build instead of shipping a bare
page.

**The order of the CSS imports decides the cascade.** Unlayered CSS beats any `@layer`,
so the reset has to be inside a layer declared before the granum ones, and your own page
styling wins precisely because it declares no layer.

### What the selection costs

Emitted CSS, measured against `@feugene/granularity@1.1.0` and `@feugene/granum@2.1.0`
with both modes on. The figures have not been re-taken on core 2 and granum 3, so read the
shape from them rather than the exact bytes:

| Selection | Components after closure | CSS | gzip | Classes |
| --- | --- | --- | --- | --- |
| `GrButton` | 1 | 60 388 B | 13 267 B | 198 |
| `GrButton`, `GrCard` | 2 | 61 370 B | 13 499 B | 222 |
| `'all'` | 84 | 173 609 B | 29 396 B | 1 223 |

Read the first row as the floor: about 59 KB of it is tokens, both themes, the base layer
and the engine preflight, and it is there no matter how little you select. The second
component adds roughly 1 KB. That shape is the point — the price of the design system is
paid once, and components are cheap after it.

"Components after closure" is what actually landed: naming nine in `examples/` selects
fifteen, because transitive dependencies come along by themselves.

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

granum ships a CLI for exactly these questions, and it reads the config file you already
have:

```bash
npx granum explain ./granum.config.mjs '@feugene/granularity:GrModal'  # why is it in the build
npx granum why-css ./granum.config.mjs 'rounded-lg'                    # who pulled this class
npx granum doctor  ./granum.config.mjs --strict                        # the whole configuration
npx granum audit   dist                                                # and the built site
```

---

## 2. Installing every component

`astro.config.mjs` is unchanged from recipe 1 — only the selection differs.

```js
export default defineGranumConfig({
  engine: windEngine(),
  providers: ['@feugene/granularity'],
  components: 'all',
  theme: 'slate',
  modes: { names: ['light', 'dark'] },
  appSources: { dirs: ['src'] },
})
```

All the components of the core — 84 at the time of the measurement above — and
171 254 B of CSS against 60 258 B for two, every byte of it blocking the first paint,
because this is the document's stylesheet.

**Worth it when the set of components genuinely is not known ahead of time**: an admin
panel assembled from a schema, a page builder, a documentation site rendering arbitrary
demos. There the alternative is not a smaller list — it is a list that goes stale
silently, and a component that renders unstyled in production.

**Not worth it as a way to skip writing the list.** A site with a known set of pages
knows its components; `'all'` there buys 111 KB of extra blocking stylesheet in exchange
for not editing one array.

It also gives up the import guard. With an explicit selection, importing a component that
is not in it fails the build; under `'all'` there is nothing to compare an import
against, and a component that quietly stops being used keeps paying for itself.

---

## 3. Your own i18n runtime

The loader format the ecosystem publishes is `fint-i18n`, so the bundled `./app`
entrypoint wires that. An application with a different runtime does not need it.

```js
// astro.config.mjs
integrations: [
  vue({ appEntrypoint: './src/vue-app.ts' }),
  granularity({ i18n: false }),
],
vite: { plugins: [granum(granumConfig)] },
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

```js
// granum.config.mjs — the satellite is a provider of its own
export default defineGranumConfig({
  engine: windEngine(),
  providers: ['@feugene/granularity', '@feugene/granularity-chrono'],
  components: [
    { provider: '@feugene/granularity', names: ['GrButton', 'GrCard'] },
    { provider: '@feugene/granularity-chrono', names: ['GrDatePicker'] },
  ],
  theme: 'slate',
  modes: { names: ['light', 'dark'] },
  appSources: { dirs: ['src'] },
})
```

Providers are named by package, not imported: granum reads each one's
`granum.manifest.json` through its `exports`, and nothing scans anybody's `dist`.

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

The integration handles both halves of what the swap breaks: the mode script re-applies
the pair on `astro:after-swap`, and the strings snapshot is re-read on every instance
creation. You do not have to do anything for either.

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
    granularity({
      i18n: { locales: ['en', 'ru'] },
      themeCookie: 'gr-theme',
    }),
  ],
  vite: { plugins: [granum(granumConfig)] },
})
```

**Strings in the HTML work here as on a static build.** The page state the snapshot is
built from lives in an `AsyncLocalStorage` context, one per request, so concurrent
requests cannot mix two pages up — see
[Strings](./i18n.md#where-the-feature-switches-itself-off).

**The mode can arrive in the HTML.** A static page can only get its pair in the browser;
a server sees the request. Keep the mode in a cookie and the server sends
`<html data-theme="slate-dark">` straight away:

```astro
---
// src/layouts/Base.astro
import { modeFromCookie, themeRootAttributes } from '@feugene/granum/runtime'
import manifest from 'virtual:granum/themes'
import { cookie } from 'virtual:granularity/theme'

// No cookie, no attribute: the server cannot see the system scheme, the script decides.
// A prerendered route has no request headers to read.
const mode = cookie && !Astro.isPrerendered
  ? modeFromCookie(manifest, Astro.request.headers.get('cookie'), cookie)
  : undefined
const rootAttributes = mode ? themeRootAttributes(manifest, mode.name) : {}
---
<html lang={Astro.currentLocale} {...rootAttributes}>
```

`cookie` is the integration's `themeCookie`: the name is written once, in `astro.config.mjs`.
The toggle from [Theme](./theme.md#writing-your-own-toggle) writes that cookie instead of
`localStorage` by itself, and the `./app` entry hands it to the core `useTheme()`.
The example stands do exactly this, and the e2e suite checks the server's HTML against the
cookie.

`themeCookie` tells the inline script to read the same cookie before `localStorage`. Where
the server has set the pair, the script leaves it alone; the cookie matters where it has
not — on `prerender = true` routes, whose HTML is built once for everyone.

**Everything else is unaffected**: auto-import, the environment check and every
component behave identically.
