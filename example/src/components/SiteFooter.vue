<script setup lang="ts">
/**
 * Подвал — серверный остров.
 *
 * Интерактива два: подсказка о версии и возврат наверх. Оба бессмысленны без
 * разметки на сервере, поэтому остров именно серверный.
 */
import { GrButton } from '@feugene/granularity/components/GrButton'
import { GrTooltip } from '@feugene/granularity/components/GrTooltip'

defineProps<{
  note: string
  version: string
  versionHint: string
  backToTop: string
}>()

function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <footer class="mt-auto border-t border-[var(--gr-brd)]">
    <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-[var(--gr-muted-fg)] lg:px-8">
      <p class="m-0">{{ note }}</p>

      <GrTooltip :text="versionHint" placement="top" :open-delay="200">
        <span
          data-testid="version-badge"
          class="cursor-help rounded-[var(--gr-radius-full)] border border-[var(--gr-brd)] px-2.5 py-0.5 font-mono text-xs"
        >granularity {{ version }}</span>
      </GrTooltip>

      <GrButton class="ml-auto" variant="ghost" size="sm" @click="toTop">
        {{ backToTop }}
      </GrButton>
    </div>
  </footer>
</template>
