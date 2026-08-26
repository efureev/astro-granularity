<script setup lang="ts">
/**
 * Остров с оверлеями — фикстура гейта `e2e/overlays.spec.ts`.
 *
 * Три компонента взяты не для полноты витрины, а как три разных пути к порталу:
 * `GrTooltip` работает с `@floating-ui` напрямую, `GrSelect` телепортирует
 * панель только в `optionsView="panel"` (нативный `<select>` портала не имеет
 * вовсе), а `GrDialog` портал не упоминает — он рендерит `GrModal`. Последний
 * случай и есть тот, который не выводится сканированием исходников.
 */
import { ref } from 'vue'
import { GrTooltip } from '@feugene/granularity/components/GrTooltip'
import { GrSelect } from '@feugene/granularity/components/GrSelect'
import { GrDialog } from '@feugene/granularity/components/GrDialog'
import { GrButton } from '@feugene/granularity/components/GrButton'

const fruit = ref('')
const dialogOpen = ref(false)

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'pear', label: 'Pear' },
  { value: 'plum', label: 'Plum' },
]
</script>

<template>
  <div data-testid="overlays">
    <GrTooltip text="Tooltip payload">
      <span data-testid="tooltip-trigger">Hover me</span>
    </GrTooltip>

    <GrSelect
      v-model="fruit"
      data-testid="select-trigger"
      options-view="panel"
      placeholder="Pick a fruit"
      aria-label="Fruit"
      :options="options"
    />

    <GrButton data-testid="dialog-trigger" @click="dialogOpen = true">
      Open dialog
    </GrButton>
    <GrDialog v-model="dialogOpen" title="Dialog payload">
      <p data-testid="dialog-body">
        Dialog body
      </p>
    </GrDialog>
  </div>
</template>
