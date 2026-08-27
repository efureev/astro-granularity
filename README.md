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
| **Environment check**     | Fails the build when `@astrojs/vue` or the UnoCSS preset is missing, naming the exact line to add                                     | `strict: false`            |

It does **not** rewrite your config. Missing `granular-preset` in `uno.config.ts` or
`@astrojs/vue` in `integrations` produces a clear error, never a silent substitution — a config that reads one way and
builds another costs days to debug.

## Install

`@floating-ui/dom` is a required peer of the core: without it the build fails on the first component that has a floating
panel.

```bash
# yarn
yarn add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom
# npm
npm i -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom
# pnpm
pnpm add -D @feugene/astro-granularity @astrojs/vue @floating-ui/dom
```

## Quick start

```js
// astro.config.mjs
import vue from '@astrojs/vue'
import granularity from '@feugene/astro-granularity'
import {defineConfig} from 'astro/config'
import UnoCSS from 'unocss/astro'

export default defineConfig({
    integrations: [
        vue({appEntrypoint: '@feugene/astro-granularity/app'}),
        UnoCSS({injectReset: true}),
        granularity({i18n: {locales: ['en', 'ru']}}),
    ],
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'ru'],
        routing: {prefixDefaultLocale: false},
    },
})
```

```ts
// uno.config.ts
import granularityProvider from '@feugene/granularity/granular-provider/node'
import {granularContent, presetGranularNode} from '@feugene/unocss-preset-granular/node'
import {defineConfig, presetMini} from 'unocss'

const options = {
    providers: [granularityProvider],
    components: [{provider: '@feugene/granularity', names: ['GrButton', 'GrCard']}],
    themes: {names: ['light', 'dark']},
    layer: 'granular',
}

const content = granularContent(options)

export default defineConfig({
    content: {
        ...content,
        // Your own sources read from disk. Without this, utilities used only inside a
        // `client:only` island never reach the stylesheet — see docs/islands.md.
        filesystem: [...(content.filesystem ?? []), 'src/**/*.{vue,astro,ts}'],
    },
    presets: [presetMini(), presetGranularNode(options)],
})
```

Both calls take the **same** options object: the first says what to scan, the second what to emit. Let them drift and
components arrive without styles.

## Documentation

|                                              |                                                                            |
|----------------------------------------------|----------------------------------------------------------------------------|
| [Recipes](./docs/recipes.md)                 | Six ways to wire this up, from a two-component install to server rendering    |
| [Theme](./docs/theme.md)                     | The three-point contract, writing your own toggle, client-side navigation  |
| [Strings](./docs/i18n.md)                    | How translations reach the HTML, snapshot modes, your own i18n runtime     |
| [Islands](./docs/islands.md)                 | Hydration directives, overlays, `client:only`, shared state                |
| [Reference](./docs/reference.md)             | Every option, export, subpath and peer range                               |
| [Troubleshooting](./docs/troubleshooting.md) | Symptom → cause → fix                                                      |

## Example

`example/` holds a working application built on this integration: a service status board, three sections across three
languages, 22 pages. Header and footer are islands; each page carries one island rendered on the server and one that is
client-only.

Lighthouse reports **100 for accessibility, best practices and SEO**, and 99–100 for performance. Numbers, measurement
conditions and what earns them are in
[`example/README.md`](./example/README.md).

## License

See [LICENSE](./LICENSE).
