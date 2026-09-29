<script setup lang="ts">
/**
 * Клиентский остров: `client:only`, и по существу, а не для примера.
 *
 * «N минут назад» отсчитывается от момента просмотра. Сервер этого момента не
 * знает: на сборке он отрисовал бы заведомо неверное значение, которое потом
 * прыгнуло бы при гидратации.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ label: string, locale: string }>()

const checkedAt = ref<Date | null>(null)
const now = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  checkedAt.value = new Date()
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 15_000)
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})

const relative = computed(() => {
  if (!checkedAt.value)
    return ''
  const minutes = Math.round((checkedAt.value.getTime() - now.value) / 60_000)
  // `numeric: 'auto'` даёт «только что» вместо «0 минут назад».
  return new Intl.RelativeTimeFormat(props.locale, { numeric: 'auto' }).format(minutes, 'minute')
})
</script>

<template>
  <!-- Место под остров резервирует страница: `client:only` на сервере не даёт
       разметки вовсе, поэтому изнутри резервировать нечем. -->
  <p data-testid="last-checked" class="m-0 flex items-center gap-1.5 text-sm text-[var(--gr-muted-fg)]">
    <template v-if="checkedAt">
      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
      <span>{{ label }}:</span>
      <time :datetime="checkedAt.toISOString()">{{ relative }}</time>
    </template>
  </p>
</template>
