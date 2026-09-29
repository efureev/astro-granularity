<script setup lang="ts">
/**
 * Клиентский остров: `client:only`, и по существу.
 *
 * Показывает то, что лежит в `localStorage` **этого** браузера. Сервер про него
 * не знает ничего, поэтому и отрисовать не может — ни правильно, ни как-либо.
 */
import type { Preferences } from '../data/preferences'
import type { UiStrings } from '../i18n/ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { GrCard } from '@feugene/granularity/components/GrCard'
import { PREFERENCES_CHANGED, readPreferences } from '../data/preferences'

const props = defineProps<{ t: UiStrings }>()

const stored = ref<Preferences | null>(null)

function refresh() {
  stored.value = readPreferences()
}

onMounted(() => {
  refresh()
  // Две подписки на два источника: `storage` приходит из соседней вкладки,
  // собственное событие — из формы на этой же странице.
  window.addEventListener('storage', refresh)
  window.addEventListener(PREFERENCES_CHANGED, refresh)
})

onUnmounted(() => {
  window.removeEventListener('storage', refresh)
  window.removeEventListener(PREFERENCES_CHANGED, refresh)
})

/** Подписи те же, что в форме: два списка значений разошлись бы незаметно. */
const densityLabel: Record<Preferences['density'], string> = {
  compact: props.t.densityCompact,
  cosy: props.t.densityCosy,
  roomy: props.t.densityRoomy,
}

const notifyLabel: Record<Preferences['notify'], string> = {
  all: props.t.notifyAll,
  incidents: props.t.notifyIncidents,
  none: props.t.notifyNone,
}
</script>

<template>
  <GrCard variant="ghost" padding="md" class="min-h-32 border border-dashed border-[var(--gr-brd)]">
    <h2 class="m-0 text-sm font-semibold tracking-tight text-[var(--gr-fg)]">{{ t.savedLabel }}</h2>
    <dl v-if="stored" data-testid="saved-prefs" class="m-0 mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      <dt class="text-[var(--gr-muted-fg)]">{{ t.fieldEnv }}</dt>
      <dd class="m-0 text-right font-mono text-[var(--gr-fg)]">{{ stored.env }}</dd>
      <dt class="text-[var(--gr-muted-fg)]">{{ t.fieldDensity }}</dt>
      <dd class="m-0 text-right text-[var(--gr-fg)]">{{ densityLabel[stored.density] }}</dd>
      <dt class="text-[var(--gr-muted-fg)]">{{ t.fieldNotify }}</dt>
      <dd class="m-0 text-right text-[var(--gr-fg)]">{{ notifyLabel[stored.notify] }}</dd>
    </dl>
    <p v-else class="m-0 mt-3 text-sm text-[var(--gr-muted-fg)]">{{ t.savedEmpty }}</p>
  </GrCard>
</template>
