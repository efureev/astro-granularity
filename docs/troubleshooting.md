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
2. A warning about `output: 'server'` or `build.concurrency` in the build log — the
   feature refuses to run where requests or pages are handled in parallel.
3. No `i18n` block in `astro.config.mjs` **and** an empty `i18n.locales` —
   `Astro.currentLocale` is `undefined` and there is nothing to match a path segment
   against, so the language is always `defaultLocale`.
4. The strings are read through `tm()` — those are absent from `'used'` by design and
   arrive with the background fetch.

Look for `<script type="application/json" data-granularity-i18n>` in the built page. No
block means no snapshot; a block with the wrong locale means the route was parsed
differently than you expect.

## "The snapshot is huge"

`ssrStrings: 'full'` embeds the whole dictionary of the page language into **every**
page — on the example that is 8.6 KB of JSON against 303 B for `'used'`. It also marks
the block loaded, so the dictionary stops being a shared cacheable chunk. For a
multi-page site that is a loss twice over.

## "The theme resets after a client-side navigation"

Expected if you wrote your own toggle without an `astro:after-swap` subscription:
`ClientRouter` strips every attribute off `<html>` and copies them from the fetched
document, which has no `data-theme`.

The integration's own script handles this. If yours does not, see
[Theme](./theme.md#client-side-navigation).

## "The theme does not survive a reload in Safari"

Private mode throws on `localStorage`. The theme must still switch — it simply will not
persist. Wrap writes in `try/catch`; the integration's script already does.

## Build fails: `Received protocol 'virtual:'`

`@astrojs/vue` breaks a static build on any `.vue` island: its `dist/server.js` imports
`virtual:astro:vue-app`, and the prerender entrypoint pulls it by a bare specifier.

The integration works around this itself by forcing Vite to inline the package into the
prerender bundle. No action needed — but if you override `vite.environments.prerender`
or `vite.environments.ssr`, keep `noExternal` intact.

## Build or dev server fails: `ERR_UNKNOWN_FILE_EXTENSION: ".css"`

Part of the core's components carry a static `import '../styles.css'` in their built
chunk. Left external, such a module is loaded by Node, which does not know `.css`. In a
static build that is the `prerender` environment; in `astro dev` and under an adapter it
is `ssr`.

Also worked around by the integration, in both environments. `GrButton` is not among
those components, which is why the defect stays invisible until a page touches one that
is.

## Build fails: `Rolldown failed to resolve import "@floating-ui/dom"`

A non-optional peer of the core. Install it:

```bash
yarn add -D @floating-ui/dom
```

## Build fails on the theme script budget

512 bytes, and it is a gate rather than a limit to raise. The script blocks the first
paint by definition, so it grows on a deliberate decision.

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
