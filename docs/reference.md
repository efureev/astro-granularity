# Reference

**English** · [Русский](./reference.ru.md)

Every option, export and range, with the reasoning behind the defaults.

## Options

```ts
granularity({ /* … */ })
```

| Option | Default | What it does |
| --- | --- | --- |
| `themeStorageKey` | `'gr-theme'` | `localStorage` key holding the mode name. Must match the core `useTheme` (`GR_THEME_STORAGE_KEY`) |
| `themeCookie` | — | Cookie holding the mode name, for SSR with granum's `createCookieStorage`. The script reads it before `localStorage` |
| `injectThemeScript` | `true` | Emit the inline mode script into `<head>`. Its pairs come from the granum plugin in `vite.plugins` |
| `resolver` | `true` | Register the auto-import resolver: `GranularityResolver()` from `@feugene/unplugin-granularity`, rooted at the project, for the core and every companion in its `package.json` |
| `i18n` | `{}` | Strings: `{ packages, locales, ssrStrings }`. `false` disables the loader module entirely |
| `i18n.packages` | `[]` | Satellite packages besides the core. The core is always included |
| `i18n.locales` | `[]` | Application languages. Empty pulls the `/i18n/all` aggregate — every language the package ships |
| `i18n.ssrStrings` | `'used'` | Snapshot in the HTML: `'used'`, `'full'` or `false`. Works in every output mode — the page state is per-request (`AsyncLocalStorage`) |
| `strict` | `true` | Fail the build on environment problems instead of warning |

Options are validated in `resolveOptions` and throw `TypeError` prefixed
`[astro-granularity]`. Validation happens at the boundary, not at the point of use, so a
typo surfaces during config rather than in the middle of a build.

The default mode is not an option of the integration: it belongs to the theme in
`granum.config`, and without a stored choice the script follows the system scheme. See
[Theme](./theme.md).

### Where the CSS comes from

The integration emits no CSS at all. It comes from `@feugene/granum`, an ordinary Vite
plugin that you register yourself:

```js
vite: {plugins: [granum(granumConfig)]}
```

and whose output you import yourself, in one place — the layout:

```astro
---
import '../styles/reset.css'   // @import '@unocss/reset/tailwind-compat.css' layer(reset);
import 'virtual:granum.css'    // five cascade layers, granum.*
import '../styles/theme.css'   // your own, unlayered — and therefore the winner
---
```

**The order is load-bearing and invisible in the code.** `virtual:granum.css` ships five
cascade layers, `granum.{tokens,base,themes,components,utilities}`, and a layer's place
in the cascade is fixed by where it first appears. Unlayered CSS beats *any* `@layer`
regardless of specificity, so:

- the browser reset must be inside a layer declared before the granum ones, or
  `button { color: inherit; padding: 0 }` from it overrides the component utilities;
- your own page styling wins over the design system precisely because it declares no
  layer — that is the intent, not an accident.

Both failures are silent: no error, no warning, just a component that looks wrong.

A project that wants the `--gr-*` scale and the modes for its own markup and uses no
components at all needs neither the plugin nor the virtual module for the CSS — one line,
`import '@feugene/granularity/styles.css'`, does it. The mode script, though, is built
from the plugin's manifest, so without the plugin there is none, and setting the pair
(`slate-light` or `slate-dark` for that stylesheet) before the first paint is up to you.
The environment check will still ask for the plugin, so turn it off with `strict: false`.

### Why `i18n.locales` matters

An explicit list switches the generated module to **named** locale imports, and unused
languages are dropped by the bundler. Leave it empty and the `/i18n/all` aggregate comes
in with every language the package publishes — for the core that is `en`, `ru` and `es`.

Block names never need listing: they live inside the loader collections themselves, and
`deriveI18nBlocks` reads them from there.

## Subpaths

| Subpath | What it exports |
| --- | --- |
| `.` | Default export — the integration factory. Named type and constant exports below |
| `./app` | `setup` for `vue({ appEntrypoint: … })` and `getGranularityI18n()` |
| `./runtime` | Browser-side building blocks and the snapshot seam |
| `./middleware` | `onRequest`. The integration registers it; you never import it |
| `./theme-middleware` | `onRequest` of the mode script for a build with additional themes and no strings in the HTML. The integration registers it |
| `./client` | Types only: `declare module 'virtual:granularity/i18n'` |
| `./package.json` | The manifest |

`./client` is an ambient declaration for applications that write their own
`appEntrypoint`:

```ts
/// <reference types="@feugene/astro-granularity/client" />
```

The entry declares a `types` condition only — there is no module behind it, so importing
the subpath at runtime fails by design. It exists for the compiler, not the bundler.

## Named exports from the root

Build-time helpers, exported because they are testable in isolation:

- `createThemeScript(manifest, { storageKey, cookie? })` — the code of the mode script
  for a granum manifest, as it goes into `injectScript('head-inline', …)`;
  `THEME_SCRIPT_BUDGET_BYTES` — its budget, 512; `THEME_SCRIPT_ADDITIONAL_BUDGET_BYTES` — the
  budget of a build with one additional theme, 1024
- `buildI18nModuleSource`, `assertPackageSpecifier`, `VIRTUAL_I18N_ID`
- `createVirtualI18nPlugin` and its types
- `createVirtualThemePlugin`, `buildThemeModuleSource`, `VIRTUAL_THEME_ID` — the `virtual:granularity/theme` module (`storageKey`, `cookie`, `headScript`) for an entry of your own
- `GRANUM_PLUGIN_NAME`, `VUE_INTEGRATION_NAME`
- Types: `GranularityAstroOptions`, `ResolvedOptions`, `SSRStringsMode`, `ThemeScriptOptions`

Plus a re-export of the `./runtime` surface for convenience.

**The snapshot seam is deliberately absent from the root.** `dist/index.js` runs in the
Astro config process, while `app.js` and `middleware.js` run inside the prerender
bundle. Their module registries differ, so a `readServerPageLocale()` imported from the
root would always read empty. Use `./runtime`, where it works.

## Named exports from `./runtime`

Nothing here imports `@feugene/fint-i18n`, not even in types — an application is free to
bring a different i18n runtime, so shapes are described structurally.

| Export | Purpose |
| --- | --- |
| `provideGranularityI18n(app, adapter, options?)` | Hand an adapter to the core. Needs only `t` and, optionally, `te` |
| `deriveI18nBlocks(loaders)` | Block names read out of the loader collections |
| `readPageLocale(defaultLocale)` | Page language from `<html lang>` |
| `readServerPageLocale()` | Route language declared by the middleware during the build |
| `readServerPageCookie()` | The page request's `Cookie` header — the island theme choice on the server; `null` when prerendering |
| `readSnapshotFromDocument()` | The strings snapshot out of the markup |
| `registerSnapshotBuilder(fn)` | Register who builds the snapshot |
| `SNAPSHOT_ATTR` | `data-granularity-i18n` |
| Types | `GranularityLocaleLoaders`, `GranularityI18nAdapterLike`, `ProvideI18nOptions`, `GranularityI18nSnapshot` |

## The virtual module

`virtual:granularity/i18n` is generated at config time from your options:

```ts
export const loaders: GranularityLocaleLoaders[]  // flattened loader collections
export const blocks: string[]                     // derived from `loaders`
export const defaultLocale: string                // from Astro's `i18n.defaultLocale`
export const locales: string[]                    // from `i18n.locales`
export const ssrStrings: 'used' | 'full' | false  // from `i18n.ssrStrings`
```

Its source is built by string interpolation, so every value that reaches it is validated
first — `assertLocaleName` and `assertPackageSpecifier` — and emitted through
`JSON.stringify`. Two independent layers, because a config value that becomes executable
code in someone else's build is not a theoretical problem.

## The environment check

Six codes, reported through `strict` — `true` fails the build on an error, `false` logs
it and carries on; a warning never fails the build:

| Code | Level | When |
| --- | --- | --- |
| `no-vue-integration` | error | `@astrojs/vue` is not among the integrations: Astro has nothing to render `.vue` with |
| `no-granum-plugin` | error | no `granum:app` in `vite.plugins`: no utilities, no tokens, no themes — components render bare |
| `duplicate-granum-plugin` | error | two instances hold two resolutions and write two reports; the virtual modules come from whichever answered first |
| `granum-without-theme-manifest` | error | the granum plugin does not hand out the mode manifest before the build (`api.themeManifest`): granum is older than the 3.2 the range asks for. Without pairs there is no mode script, and the first frame flashes |
| `granum-plugins-unreadable` | warn | the plugin list could not be unwrapped. "Not checked" is not "not there" |
| `theme-script-skipped` | warn | the granum plugin was not in `vite.plugins` yet when this integration set up — another integration added it later. The CSS arrives, the mode script does not |

The two mode codes, `granum-without-theme-manifest` and `theme-script-skipped`, only
appear with `injectThemeScript` on.

**It runs in `astro:config:done`, not `astro:config:setup`.** The plugin list is only
complete once every integration has run, so a check in `setup` would fail a healthy
project depending on the order of integrations. A side benefit: `@astrojs/vue` added by
another integration is seen too.

The mode script is the one exception: it has to be injected in `setup`, so the manifest
is looked up there. What it found is judged in `done`, against the full list — that is
how a plugin added later is told apart from a missing one.

## Peer ranges

| Peer | Range | Optional |
| --- | --- | --- |
| `astro` | `>=7.0.0 <8.0.0` | no |
| `@astrojs/vue` | `>=7.0.0 <8.0.0` | yes |
| `@feugene/granularity` | `>=3.1.1 <4.0.0` | no |
| `@feugene/granum` | `>=3.10.0 <4.0.0` | no |
| `@feugene/fint-i18n` | `>=0.9.0 <1.0.0` | yes |

`@feugene/granum` is required: the integration reads the plugin's `api.themeManifest` and
has the mode script written by `createThemeScriptCode` from `@feugene/granum/runtime`. The
floor is 3.10: core 3 stands on it. The core is no older than 3.1.1: `useTheme()` in islands
follows the pair on the root set by a toggle or by the script after a client-side navigation.

**A floor sits at the version the gate runs on.** A range claiming support for something
nobody tested is worse than a narrow one: the install succeeds and the breakage surfaces
later, in your app. Widening a range means the combination was actually exercised, not
that it ought to work.

Intermediate Astro majors are not supported by decision, not by omission: the integration
relies on `vite.environments.prerender`, which did not exist before Astro 6, and is
tested against 7 only.

`@astrojs/vue` is optional because a site that only wants the flash-free mode has no
Vue islands at all. `@feugene/fint-i18n` is optional because an application may bring its
own i18n runtime — see [recipe 3](./recipes.md#3-your-own-i18n-runtime). `./app` is the one
entry built on it: with `appEntrypoint: '@feugene/astro-granularity/app'` it has to be
installed, and nothing installs an optional peer for you.

## What is not published

`files` is `dist` and `client.d.ts`. Sources, the example and these documents stay in the
repository. A new published directory has to be added to **both** `files` and `exports`:
missing either produces a package that installs but cannot be imported.
