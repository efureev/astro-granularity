# Islands

**English** · [Русский](./islands.ru.md)

## Overlays do not need `client:only`

Not one core component does. This is worth stating plainly because the opposite is the
common assumption: a component that uses a portal surely cannot survive SSR.

It can. `useTeleportEnabled()` in the core disables teleporting on the server *and* on
the first client render, so panels arrive from the server inside their own component's
markup and move into `body` only after mounting. Server markup and first client render
therefore match.

`client:only` here is not merely redundant — it is harmful: it throws the server markup
away. The claim is held by a gate rather than by a list of component names, because
"works with a portal" is derived from a component's implementation and disagrees with
observation.

```astro
<!-- correct -->
<OverlayDemo client:load />

<!-- throws away the server markup -->
<OverlayDemo client:only="vue" />
```

### What does need hiding

Imperative calls, not markup. `useDialogService().confirm()`, `createLoading()` and
`setTheme()` without the plugin mount a host into `document.body` and throw on the
server. Guard those with `if (typeof window !== 'undefined')` or move them into
`onMounted`.

## When `client:only` is the right answer

When the server genuinely cannot produce the right output — not when a component "feels
client-side".

```astro
<!-- "N minutes ago" relative to the moment of viewing. The server does not know
     that moment and would render something knowably wrong. -->
<LastChecked client:only="vue" label={t.lastChecked} locale={locale} />

<!-- Reads this browser's localStorage. -->
<SavedPreferences client:only="vue" t={t} />
```

Two consequences follow, and both bite silently.

### Reserve the space in the page, not the component

Until it mounts, the component does not exist — a `min-height` inside it reserves
nothing. The `<astro-island>` placeholder is empty and has zero height, so the island
appearing shifts everything below it.

```astro
<div class="min-h-5">
  <LastChecked client:only="vue" … />
</div>
```

On the example's overview page this is the difference between CLS `0.008` and CLS `0`.

### Utilities used only there never reach the CSS

`granularContent(options)` covers the library's `dist`; your own files are picked up by
the transform pipeline. A `client:only` island is absent from the server build, and the
client build runs after the stylesheet is emitted — so a class used **only** inside such
an island is never generated. The island arrives unstyled, with no error and no warning.

```ts
const content = granularContent(options)

export default defineConfig({
  content: {
    ...content,
    filesystem: [...(content.filesystem ?? []), 'src/**/*.{vue,astro,ts}'],
  },
  presets: [presetMini(), presetGranularNode(options)],
})
```

To check this yourself, put a unique utility (`mt-[3px]`) inside a `client:only` island
and another inside a `client:load` one, then grep the built stylesheet for both. **Grep
for the escaped form** — the file contains `mt-\[3px\]`, and a pattern without the
backslashes finds nothing and manufactures a false alarm.

## Hydration directives

| Directive | Server markup | Use for |
| --- | --- | --- |
| `client:load` | yes | Content, navigation, overlays — anything that must exist without JS |
| `client:idle` | yes | Interactive but not urgent |
| `client:visible` | yes | Below the fold. **Note:** an island that never scrolls into view never hydrates |
| `client:media` | yes | Viewport-conditional |
| `client:only` | **no** | Only when the server cannot produce the right output |

`client:visible` deserves the warning: a test that clicks such an island without
scrolling to it will time out waiting for a handler that was never attached.

## No `provide`/`inject` between islands

Each island is its own Vue root. Two islands on one page cannot share provided values.

Shared state has three honest routes: the DOM, a module-level singleton (that is how the
i18n instance works), or an external store. For communication between islands on the same
page, a window event is the plainest thing that works:

```ts
// the writer
window.dispatchEvent(new CustomEvent('app:preferences'))

// the reader
onMounted(() => window.addEventListener('app:preferences', refresh))
onUnmounted(() => window.removeEventListener('app:preferences', refresh))
```

`<GrConfigProvider>` defaults are set by each island root separately — the core does not
expose an app-level path for them.

## Auto-import works only in `.vue`

Astro compiles `.astro` files with its own parser, and `unplugin-vue-components` does not
reach inside. Imports there are explicit:

```astro
---
import { GrButton } from '@feugene/granularity/components/GrButton'
---
```

## Testing an island

**Wait for hydration before interacting.** A control arrives in the server markup and is
actionable immediately, while its handler only exists after Vue mounts. A click in
between goes nowhere, and the test fails on a timeout waiting for something nobody did.

```ts
async function hydrated(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0)
}
```

Astro removes the `ssr` attribute itself once an island hydrates. Checks of the *server
markup* (`javaScriptEnabled: false`) must not call this — there is no hydration there to
wait for.

This race does not reproduce on an idle machine, which is exactly why it is worth
handling rather than re-running.

## After hydration, panels move out

A `GrSelect` panel in `optionsView="panel"` teleports into `body` once mounted. A test
with JavaScript enabled will not find its contents inside the component's markup — they
are no longer there. Look for them page-wide, or scope to the portal.
