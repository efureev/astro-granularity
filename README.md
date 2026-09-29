# @feugene/astro-granularity

**English** · [Русский](./README.ru.md)

An [Astro](https://astro.build) integration for the
[`@feugene/granularity`](https://github.com/efureev/granularity) design system.

One line in `astro.config.mjs` and the library is wired: the theme is applied **before the first paint**, component
strings ship inside the HTML, auto-import is registered, and a misconfigured environment fails the build with a message
that names the fix instead of quietly serving an unstyled page.

Requires **Astro 7**.

## What it actually does

Four separate things, each switchable off. An integration you cannot partially disable becomes an obstacle on the first
project that does not fit its assumptions.

|                           | What                                                                                                                                  | Off with                   |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------|----------------------------|
| **Theme without a flash** | A synchronous inline script in `<head>` resolves the theme the same way the core `useTheme` does, and survives client-side navigation | `injectThemeScript: false` |
| **Strings in the HTML**   | A middleware declares the route locale before the page renders and embeds a snapshot of the translations into `<head>`                | `i18n.ssrStrings: false`   |
| **Auto-import**           | Registers the `unplugin-vue-components` resolver, so `<GrButton>` needs no import inside `.vue`                                       | `resolver: false`          |
| **Environment check**     | Fails the build when `@astrojs/vue` or the `granum` Vite plugin is missing, naming the exact line to add                              | `strict: false`            |

It does **not** rewrite your config. A missing `granum` plugin in `vite.plugins` or `@astrojs/vue` in `integrations`
produces a clear error, never a silent substitution — a config that reads one way and builds another costs days to
debug.

The CSS pipeline stays yours: `granum` is an ordinary Vite plugin, you register it and you import its stylesheet. The
integration knows one thing about it — the plugin name — so the version of `granum` remains your choice.

## Install

`@floating-ui/dom` is a required peer of the core: without it the build fails on the first component that has a floating
panel.

```bash
# yarn
yarn add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom @feugene/granum @feugene/granum-engine-wind
# npm
npm i -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom @feugene/granum @feugene/granum-engine-wind
# pnpm
pnpm add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom @feugene/granum @feugene/granum-engine-wind
```

`@feugene/granum` builds the CSS and `@feugene/granum-engine-wind` is the utility engine it runs. Both are build-time
only: nothing of them ships to the browser.

## Quick start

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
    themes: {names: ['light', 'dark']},
    // Your own sources, read from disk. A utility used only inside a `client:only`
    // island reaches the stylesheet without any extra setting.
    appSources: {dirs: ['src']},
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

**The order of the CSS imports decides the cascade.** Unlayered CSS beats any `@layer` regardless of specificity, so the
browser reset has to live inside a layer declared *before* the granum ones — otherwise `button { color: inherit;
padding: 0 }` from the reset overrides the component utilities, silently and without a warning.

## Documentation

|                                              |                                                                            |
|----------------------------------------------|----------------------------------------------------------------------------|
| [Recipes](./docs/recipes.md)                 | Six ways to wire this up, from a two-component install to server rendering    |
| [Theme](./docs/theme.md)                     | The three-point contract, writing your own toggle, client-side navigation  |
| [Strings](./docs/i18n.md)                    | How translations reach the HTML, snapshot modes, your own i18n runtime     |
| [Islands](./docs/islands.md)                 | Hydration directives, overlays, `client:only`, shared state                |
| [Reference](./docs/reference.md)             | Every option, export, subpath and peer range                               |
| [Troubleshooting](./docs/troubleshooting.md) | Symptom → cause → fix                                                      |

## Examples

`examples/` holds the same application in all three Astro output modes — `static`, `ssr` and `hybrid`. It is one
application, not three: layouts, components, styles, data and strings live in `examples/shared`, and a stand owns only
its `astro.config.mjs`, its `granum.config.mjs` and thin route wrappers.

That is the point. Because the UI is shared, a difference between the stands cannot be a difference between
applications — it is always the output mode, and a browser gate compares the three pixel for pixel on every run.

The application itself is a service status board: three sections across three languages, 22 pages. Header and footer are
islands; each page carries one island rendered on the server and one that is client-only. Lighthouse reports **100 for
accessibility, best practices and SEO**, and 99–100 for performance. Numbers, measurement conditions, and what each mode
changes are in [`examples/README.md`](./examples/README.md).

## License

See [LICENSE](./LICENSE).
