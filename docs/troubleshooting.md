# Troubleshooting

**English** · [Русский](./troubleshooting.ru.md)

Symptoms in the order you are likely to meet them.

## "My change to the package is not visible"

The most common and the quietest. A consuming app resolves the package through its
`exports`, which point at `dist/`. Editing the source without rebuilding changes nothing,
and no error says so.

```bash
yarn build   # then rebuild the site
```

## "A component arrived bare"

Four checks, in this order:

1. `granum(granumConfig)` is in `vite.plugins`. Without it nothing is emitted at all, and
   the integration says so by failing the build.
2. `import 'virtual:granum.css'` is in the layout. The plugin generates the stylesheet;
   importing it is the application's job.
3. The component is in the `components` selection — `granum explain <config> '<pkg>:<Name>'`
   answers why it is or is not. Transitive dependencies are closed automatically, so
   naming `GrDialog` brings `GrModal`.
4. The class has a rule behind it — `granum why-css <config> '<class>'`.

## "The button has colour, but its text inherits the page colour — or its padding is gone"

The browser reset is outside a cascade layer. Unlayered CSS beats *any* `@layer`
regardless of specificity, so `button { color: inherit; padding: 0 }` from the reset
overrides the component utilities that live in `@layer granum.utilities`.

```css
/* src/styles/reset.css */
@import '@unocss/reset/tailwind-compat.css' layer(reset);
```

The layer also has to be declared **before** the granum ones — a layer's place in the
cascade is fixed by where it first appears — so this file is the first import of the
layout.

## "The build fails with `ComponentOutsideSelectionError`"

A component is imported that the `components` selection does not name. Either add it, or
switch to `components: 'imports'` and let the selection follow the imports.

The guard only sees imports that survive transpilation: an import that is never used is
elided before the bundler resolves it, so an unused component neither fails the build nor
contributes CSS.

## "An overlay is empty"

`client:only` causes this rather than curing it: it throws away the server markup.
Overlays want `client:load`. See [Islands](./islands.md#overlays-do-not-need-clientonly).

If the overlay is empty on the *server* specifically, that may be correct: `GrModal` does
not send its slot to the server even when open.

## "Component strings are empty or show the key"

- `appEntrypoint: '@feugene/astro-granularity/app'` missing from `vue()` — no i18n
  instance is created at all.
- The key shows itself instead of English text — `preloadFallback` did not run; without
  it `fallbackLocale` is declared but empty until the first language switch.

## "Strings in the HTML are English, and turn Russian after hydration"

The snapshot did not arrive. In order:

1. `i18n.ssrStrings: false` — switched off explicitly.
2. No `i18n` block in `astro.config.mjs` **and** an empty `i18n.locales` —
   `Astro.currentLocale` is `undefined` and there is nothing to match a path segment
   against, so the language is always `defaultLocale`.
3. The strings are read through `tm()` — those are absent from `'used'` by design and
   arrive with the background fetch.

Look for `<script type="application/json" data-granularity-i18n>` in the built page. No
block means no snapshot; a block with the wrong locale means the route was parsed
differently than you expect.

## "The snapshot is huge"

`ssrStrings: 'full'` embeds the whole dictionary of the page language into **every**
page — on the example that is 8.6 KB of JSON against 303 B for `'used'`. It also marks
the block loaded, so the dictionary stops being a shared cacheable chunk. For a
multi-page site that is a loss twice over.

## "The page flashes: the mode script is missing"

The built page has no inline script with the pairs in its `<head>`. The build log says
why:

1. **The `theme-script-skipped` warning.** The granum plugin was added by another
   integration that runs after `astro-granularity`: when this one set up, the plugin was
   not in `vite.plugins` yet, and there was no manifest to build the script from. The CSS
   still arrives, which is what makes this one easy to miss. Put `granum(granumConfig)`
   directly into `vite.plugins` of the Astro config.
2. **The `granum-without-theme-manifest` error.** The installed granum does not hand the
   mode manifest out before the build. Update `@feugene/granum` and
   `@feugene/granum-engine-wind` to `^3.2.0`. Under `strict: false` the build goes on
   without the script — and the page flashes.

Neither in the log? Then `injectThemeScript: false` is set, or the granum build has no
modes at all.

## "Components stay light in dark mode — `data-theme="dark"` does nothing"

Core 2 is styled by the pair only: `[data-theme="slate-dark"]`. A bare mode name —
`data-theme="dark"`, the way integration 1.x and the toggles written for it set it —
matches no selector, so components stay in the default mode, and so does
`color-scheme`. Your own CSS keyed on `[data-theme='dark']` goes quiet the same way.

Take the pairs from the build instead of writing them: switch modes with granum's
controller — `createThemeController(manifest, { storageKey: 'gr-theme' })` over
`import manifest from 'virtual:granum/themes'` — or with the core `useTheme()`. See
[Theme](./theme.md#writing-your-own-toggle). In your CSS, select on the pair, or take
colours from `--gr-*` tokens and need no selector at all.

## "The chosen mode does not survive a reload"

- **Another key.** granum's controller stores under `granum-theme` unless told
  otherwise, while the script reads `themeStorageKey`, `gr-theme` by default. Pass
  `storageKey: 'gr-theme'`.
- **The pair stored instead of the name.** `localStorage['gr-theme']` holds `dark`, not
  `slate-dark`; anything that is not a mode of the build is skipped.
- **`data-theme` hard-coded in the layout.** The script takes a pair already on `<html>`
  for the server's and keeps it, so the stored choice never applies. Leave the attribute
  out of the markup; on a server, set it from the cookie only — see
  [recipe 6](./recipes.md#6-server-side-rendering).
- **Safari private mode.** Storage writes throw there. The mode still switches, it simply
  does not persist. granum's controller catches the throw; a toggle that writes storage
  by hand needs its own `try/catch`.

## "The mode resets after a client-side navigation"

`ClientRouter` strips every attribute off `<html>` and copies them from the fetched
document, which carries no `data-theme` unless a server put the pair in. The integration's
script re-applies the stored mode on `astro:after-swap`, so a mode lost on navigation was
not stored where the script reads it — see the previous section. With `injectThemeScript: false` the re-run is your
own early script's job: see [Theme](./theme.md#client-side-navigation).

## Build fails: `Received protocol 'virtual:'`

`@astrojs/vue` breaks a static build on any `.vue` island: its `dist/server.js` imports
`virtual:astro:vue-app`, and the prerender entrypoint pulls it by a bare specifier.

The integration works around this itself by forcing Vite to inline the package into the
prerender bundle. No action needed — but if you override `vite.environments.prerender`
or `vite.environments.ssr`, keep `noExternal` intact.

## Build or dev server fails: `ERR_UNKNOWN_FILE_EXTENSION: ".css"`

The design system's built chunks import no `.css` — a component's own stylesheet reaches
the page through granum — so Node loads the packages as they are, in `prerender` and in
`ssr` alike. This error means a companion package built before 1.0.1, when the build
still stitched `import './styles.css'` into the chunk. Update it to 2.x, the line that goes
with core 2.

## Build fails: `ComponentRootImportError`

A component is imported from a package root: `import { GrButton } from
'@feugene/granularity'`. granum rejects that — its selection only sees a component by
its subpath, and the root pulls in the whole package. Import from the subpath,
`@feugene/granularity/components/GrButton`; in `.vue` the auto-import resolver writes it
for you. Utilities, plugins and types may still come from the root.

## The granum build line counts classes "without a rule"

granum reports a class from your markup that neither the engine nor the build's CSS
defines: a typo, or a class whose rule is gone. The report reads the CSS of every build
environment, and a `.css` file inside `appSources` declares its classes even when it
reaches the page as a string (`?raw` into `<style set:html>`), so a class in the list has
no rule anywhere. `granum why-css <config> '<class>'` explains one, and
`granum report --strict` can gate CI.

## Build fails: `Rolldown failed to resolve import "@floating-ui/dom"`

A non-optional peer of the core. Install it:

```bash
yarn add -D @floating-ui/dom
```

## Build fails: `"createFintI18n" is not exported by "__vite-optional-peer-dep:@feugene/fint-i18n/core…"`

`appEntrypoint: '@feugene/astro-granularity/app'` is set, and `@feugene/fint-i18n` is not installed. It is an optional
peer, so no package manager adds it, and Vite replaces the missing module with an empty stub. Install it:

```bash
yarn add @feugene/fint-i18n
```

With your own i18n runtime, point `appEntrypoint` at your own setup instead — see
[recipe 3](./recipes.md#3-your-own-i18n-runtime).

## The build warns about the mode script budget

512 bytes on a theme with two modes: a gate for the package itself, a warning for your
build. The script blocks the first paint, and every mode of your build adds its name and
pair to it — on `slate` with two modes it is 407 bytes, 497 with `themeCookie`. Past the
budget nothing breaks: the warning names the size and the number of modes, and whether
each mode is worth its bytes on the critical path is your call.

## `@feugene/astro-granularity/client` does not resolve

Fixed in the release following 0.3.0. Before that the subpath was missing from `exports`
while `client.d.ts` shipped in the tarball, so the reference failed under
`moduleResolution: bundler` and `node16` — `exports` closes off everything it does not
list. Upgrade, or reference the file by path.

## `astro dev` does not start

Known, cause unidentified: `Dev server process exited before becoming ready` on Astro
7.2.x with Node 26. Check by hand through a build plus a static server instead.

One consequence worth naming: Vue reports hydration mismatches only in a dev build, so
while `astro dev` is unavailable, nothing surfaces them.
