# Reference

**English** · [Русский](./reference.ru.md)

Every option, export and range, with the reasoning behind the defaults.

## Options

```ts
granularity({ /* … */ })
```

| Option | Default | What it does |
| --- | --- | --- |
| `defaultTheme` | `'system'` | Theme when nothing is stored: `'light'`, `'dark'` or `'system'` |
| `themeStorageKey` | `'gr-theme'` | Storage key. Must match the core `useTheme` |
| `injectThemeScript` | `true` | Emit the inline theme script into `<head>` |
| `injectStyleBundle` | `false` | Import `@feugene/granularity/styles.css` — themes, tokens, base layer. Gives **no** component styles |
| `resolver` | `true` | Register the auto-import resolver |
| `i18n` | `{}` | Strings: `{ packages, locales, ssrStrings }`. `false` disables the loader module entirely |
| `i18n.packages` | `[]` | Satellite packages besides the core. The core is always included |
| `i18n.locales` | `[]` | Application languages. Empty pulls the `/i18n/all` aggregate — every language the package ships |
| `i18n.ssrStrings` | `'used'` | Snapshot in the HTML: `'used'`, `'full'` or `false` |
| `strict` | `true` | Fail the build on environment problems instead of warning |

Options are validated in `resolveOptions` and throw `TypeError` prefixed
`[astro-granularity]`. Validation happens at the boundary, not at the point of use, so a
typo surfaces during config rather than in the middle of a build.

### Why `injectStyleBundle` defaults to `false`

With `presetGranularNode` running, tokens, themes and the base layer already arrive from
`virtual:uno.css` as preflights. Importing the bundle on top would ship a second copy of
every one of them.

Turning it on is **not** a way to use the components without UnoCSS. The bundle carries
custom properties and element-level rules; the components are marked up with utility
classes, and of the 114 they use it defines none. Under the bundle alone a `GrButton`
gets its colours and nothing else — no layout, no size, no radius.

Its real use is your own markup on the `--gr-*` tokens, with no components involved —
[recipe 5](./recipes.md#5-tokens-without-components).

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

- `createThemeScript(storageKey, defaultTheme)`, `resolveTheme`, `THEME_SCRIPT_BUDGET_BYTES`
- `buildI18nModuleSource`, `assertPackageSpecifier`, `VIRTUAL_I18N_ID`
- `createVirtualI18nPlugin` and its types
- `GRANULAR_PRESET_NAME`, `VUE_INTEGRATION_NAME`
- Types: `GranularityAstroOptions`, `ResolvedOptions`, `DefaultTheme`, `ThemeName`, `SSRStringsMode`

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

## Peer ranges

| Peer | Range | Optional |
| --- | --- | --- |
| `astro` | `>=7.0.0 <8.0.0` | no |
| `@astrojs/vue` | `>=7.0.0 <8.0.0` | yes |
| `@feugene/granularity` | `>=0.36.0 <1.0.0` | no |
| `@feugene/fint-i18n` | `>=0.7.0 <1.0.0` | yes |

**A floor sits at the version the gate runs on.** A range claiming support for something
nobody tested is worse than a narrow one: the install succeeds and the breakage surfaces
later, in your app. Widening a range means the combination was actually exercised, not
that it ought to work.

Intermediate Astro majors are not supported by decision, not by omission: the integration
relies on `vite.environments.prerender`, which did not exist before Astro 6, and is
tested against 7 only.

`@astrojs/vue` is optional because a site that only wants the flash-free theme has no
Vue islands at all. `@feugene/fint-i18n` is optional because an application may bring its
own i18n runtime — see [recipe 6](./recipes.md#6-your-own-i18n-runtime).

## What is not published

`files` is `dist` and `client.d.ts`. Sources, the example and these documents stay in the
repository. A new published directory has to be added to **both** `files` and `exports`:
missing either produces a package that installs but cannot be imported.
