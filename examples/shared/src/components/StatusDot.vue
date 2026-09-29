<script setup lang="ts">
/**
 * Состояние сервиса: цветная точка, подпись и подсказка «что это значит».
 *
 * Цвет не единственный носитель смысла — рядом всегда стоит текст, иначе
 * состояние было бы недоступно тем, кто не различает эти цвета.
 */
import type { ServiceStatus } from '../data/services'
import { GrTooltip } from '@feugene/granularity/components/GrTooltip'

defineProps<{
  status: ServiceStatus
  label: string
  hint: string
}>()

const dotClass: Record<ServiceStatus, string> = {
  operational: 'bg-[var(--gr-success)]',
  degraded: 'bg-[var(--gr-warning)]',
  outage: 'bg-[var(--gr-danger)]',
}

const textClass: Record<ServiceStatus, string> = {
  operational: 'text-[var(--gr-success-text)]',
  degraded: 'text-[var(--gr-warning-text)]',
  outage: 'text-[var(--gr-danger-text)]',
}
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <span class="h-2 w-2 shrink-0 rounded-[var(--gr-radius-full)]" :class="dotClass[status]" aria-hidden="true" />
    <span class="text-sm font-medium" :class="textClass[status]">{{ label }}</span>
    <GrTooltip :text="hint" placement="top" size="sm" :open-delay="150">
      <span
        data-testid="status-hint"
        class="inline-flex h-4 w-4 items-center justify-center rounded-[var(--gr-radius-full)] text-[var(--gr-muted-fg)]"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" stroke-linecap="round" />
        </svg>
      </span>
    </GrTooltip>
  </span>
</template>
