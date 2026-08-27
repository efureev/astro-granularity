# Changelog

All notable changes to the [`@feugene/astro-granularity`](.) package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **The theme no longer disappears on a client-side navigation.** Astro's `ClientRouter`
  strips every attribute off `<html>` and copies them from the fetched document, where
  `data-theme` does not exist — the inline script never ran on it. The script now applies
  the theme from a named function and subscribes that function to `astro:after-swap`, on
  `document` rather than `window`, because Astro dispatches a non-bubbling event. The
  subscription sits under its own `try/catch`: an exception in `<head>` halts document
  parsing, and the existing gate caught the first attempt that did not.
- **Component strings no longer stay in the first page's language after a client-side
  navigation.** The snapshot was read once at module scope, and `ClientRouter` swaps the
  whole `<head>` without re-executing modules. It is now read on every instance creation.


### Changed

- **The peer floor on `@feugene/granularity` moves to `>=0.36.0 <1.0.0`.** The gate only
  ever runs against 0.36.0, and a range claiming support for a version that was never
  tested is worse than a narrow one: the install succeeds and the breakage surfaces later,
  in the consumer's app. This follows the same decision the ring made for its own
  satellites. Nothing in this package's API changed.

  **Breaking for anyone on `@feugene/granularity` 0.35.x**: the install now reports a peer
  conflict instead of staying silent. The fix is to move the core up.

- **The peer floor on `@feugene/fint-i18n` moves to `>=0.7.0 <1.0.0`**, for the same
  reason. The SSR pair this package calls — `getSSRState` and `hydrate` — does exist in
  0.6.0, so nothing was broken before; what changes is the claim. 0.7.0 is the only
  version the gate has ever run against.

  **Breaking for anyone on `@feugene/fint-i18n` 0.6.x.** The dependency stays optional:
  an application bringing its own i18n runtime does not install it at all.
- Development dependencies moved up: `astro` 7.2.8, `vue` 3.5.42, `sharp` 0.35.4,
  `@types/node` 26.4.0, `@feugene/granularity-chrono` 0.10.0 and
  `@feugene/unplugin-granularity` 0.7.0. The last two raise their peer floors to the
  versions the ecosystem actually ships, which is what silenced the `incorrect peer`
  warning the example produced against the current preset.

## [v0.2.0] 2026-08-27

### Changed

- Development now runs against `@feugene/granularity` 0.36.0. The peer range is unchanged
  (`>=0.35.0 <1.0.0`) — the integration itself does not depend on anything new.

### Removed

- **`<ThemeToggle>` and the whole `./components/*` subpath.** A theme switch is
  application markup, not integration surface: the package writes the reader half of
  the contract (the inline script) and has no business shipping the writer half as a
  published component. `files` and `exports` lose `components` entirely.

  The contract itself is unchanged and now documented as a recipe in the README —
  storage key, `data-theme` on `documentElement`, `colorScheme`. A working
  implementation lives in `example/src/components/ThemeToggle.astro`.

  **Breaking** for anyone importing `@feugene/astro-granularity/components/ThemeToggle.astro`:
  copy that file into the application.

### Added

- Translations are now rendered into the static HTML instead of being fetched by the client.
  A pre-ordered middleware declares the route locale before the page renders and embeds a
  snapshot of the strings into `<head>`; the island entry point applies that snapshot
  synchronously before `app.mount`, so the first client render already matches the server.
  No per-page code is required — registering the integration is enough.
- `i18n.ssrStrings` option — `'used'` (default) carries only the keys the server actually
  rendered on that page and lets the client keep the dictionary as a shared cacheable chunk;
  `'full'` carries the whole dictionary of the page locale and removes the chunk fetch
  entirely; `false` disables the middleware.
- `./middleware` subpath, plus `readServerPageLocale`, `readSnapshotFromDocument`,
  `registerSnapshotBuilder`, `SNAPSHOT_ATTR` and `GranularityI18nSnapshot` exported from
  `./runtime` for applications that ship their own `appEntrypoint`.
- Browser gates for the server-rendered strings: markup checked with JavaScript disabled,
  hydration checked with the dictionary chunks blocked, and a 2 KB budget on the snapshot.

### Fixed

- The prerender pass no longer renders every page with the default locale. The i18n instance
  is now keyed by locale rather than being a single module-level singleton — a prerender is
  one process for the whole build, so the first page rendered used to fix the locale for all
  the others.
- The app entry point now awaits the dictionary before `renderToString`, which is what made
  static pages ship the components' literal English fallbacks.

## [v0.1.0] 2026-08-26

### Added

- Astro integration entry point: injects the flash-free theme script, registers the
  auto-import resolver and validates the environment.
- Flash-free theme script rendered inline into `<head>`. Resolves the theme exactly like the
  core `useTheme` (stored choice → `prefers-color-scheme` → `defaultTheme`) and also sets
  `color-scheme`, which the core does not set at all — without it native scrollbars, selects
  and inputs stay light on a dark page.
- Environment gate: fails the build when `@astrojs/vue` is missing or when the UnoCSS config
  has no `granular-preset`. The config is never patched silently — a silently rewritten
  `uno.config.ts` produces bugs that take days to find.
- Size budget for the theme script (512 B). It blocks first paint by definition, so it grows
  by decision, not by accident.
- Generated virtual module with locale loaders. Explicit `locales` import named exports so
  unused languages are dropped; without them the aggregate pulls every locale. Block names
  are derived from the loaders themselves — they sit inside the collection as its
  second-level key — so the integration keeps no registry of "package → block constant".
  Those constant names are not derivable from the package name (`granularity-forms-schema`
  declares `grForms`), which is what a registry would otherwise exist for.
- Package specifiers are validated before substitution and emitted through `JSON.stringify`,
  the same two layers that already guard locale names: both reach the generated module as
  identifiers, and an unchecked one becomes executable code in someone else's build.
- Shared i18n instance for `vue({ appEntrypoint: '@feugene/astro-granularity/app' })` — one
  per page, not per island: islands are separate Vue roots but share the module graph.
- `@feugene/astro-granularity/runtime` — the browser-side pieces, free of any `fint-i18n`
  import even in types: `deriveI18nBlocks`, `readPageLocale` and `provideGranularityI18n`.
  An application on another i18n runtime sets `i18n: false`, writes its own entrypoint and
  hands over an adapter; the core asks it for `t` and, when available, `te`.
  `provideGranularityI18n` also publishes under the `fint-i18n` key by default — packages
  that have not moved to the core composable look only there, and without it they fall back
  to English in silence.
- `client.d.ts` declares the virtual module, so an application writing its own entrypoint
  gets types for it.
- `i18n: false` still resolves the virtual id and throws an explaining error on load: left
  unresolved, a forgotten `appEntrypoint` surfaces as a raw Vite "Failed to resolve import"
  naming a module the application author never wrote.
- `<ThemeToggle>` Astro component. No Vue: one delegated handler for every button on the page.
- CI (`.github/workflows/ci.yml`): typecheck, unit tests on Node 22 and 24, the browser
  gates, `publint`, and publication on a `v*` tag with provenance plus a GitHub Packages
  mirror. Publication depends on the browser gates as well — a build that drops the first
  paint or the server markup of an island must not ship, and neither defect is visible to
  anything but a browser.
- Overlay gate (`e2e/overlays.spec.ts`): an island with `GrTooltip`, `GrSelect` in panel mode
  and `GrDialog` on `client:load`, asserting that the markup arrives from the server and that
  the panels open after hydration. Verified by a reverse run — with `client:only="vue"` the
  server-markup assertions fail.

### Changed

- Toolchain moved to current majors: Astro 7, TypeScript 7, Vite 8, `@types/node` 26,
  esbuild 0.28, sharp 0.35.
- Type-checking switched from `vue-tsc` to plain `tsc`. The package has no `.vue` files in
  its compile scope — `vue-tsc` came from the template it was scaffolded off. It also blocks
  TypeScript 7, which no longer exports `typescript/lib/tsc`.

### Fixed

- Static builds crashed with `Received protocol 'virtual:'` on any `.vue` island. The cause
  is upstream: `@astrojs/vue/dist/server.js` starts with
  `import { setup } from 'virtual:astro:vue-app'`, while the prerender entry imports it as
  a bare specifier, so Node's ESM loader gets the unresolved virtual id. The integration
  forces it to be bundled. Not our defect, but ours to work around: otherwise every consumer
  hits it on their first island.

  The setting goes to `environments.prerender.resolve.noExternal`, not to `ssr.noExternal`:
  Astro 6 moved the build to Vite's Environments API and prerendering became its own
  environment, which the legacy key no longer covers.

- Static builds crashed with `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".css"`
  as soon as an island reached one of the 19 core components (of 78 in 0.35.0) whose built
  chunk carries a static `import '../styles.css'` — `GrIcon`, `GrSelect`, `GrToaster` among
  them. Left external in the prerender environment, such a module is loaded by Node, which
  cannot import CSS. `GrButton` is not one of them, which is why the defect stayed invisible.
  The `@feugene/granularity*` family is now bundled into the prerender environment too.

- The e2e gate could not fail. `astro preview` daemonises in Astro 7.2.7: it returns within a
  second and leaves a background server behind. Playwright treats that as "webServer exited
  early", so the suite only ran when a stale daemon happened to already hold the port — and
  it then tested whatever build that daemon was started with. Preview is replaced by a
  dependency-free foreground static server (`e2e/serve.mjs`) and `reuseExistingServer` is off,
  so every run serves a freshly built `dist`.
