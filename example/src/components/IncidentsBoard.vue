<script setup lang="ts">
/**
 * Список отчётов — серверный остров.
 *
 * Отрисован на сервере: отчёты это содержимое страницы, они обязаны быть в
 * разметке и без JS. Интерактив добавляет фильтр по дате из пакета-спутника
 * `@feugene/granularity-chrono` — именно он приводит в сборку второй блок строк.
 */
import type { UiStrings } from '../i18n/ui'
import { computed, ref } from 'vue'
import { GrDatePicker } from '@feugene/granularity-chrono/components/GrDatePicker'
import { GrButton } from '@feugene/granularity/components/GrButton'

type Item = {
  slug: string
  href: string
  title: string
  summary: string
  /** ISO-строка: острову значения приезжают сериализованными. */
  date: string
  service: string
  severity: 'minor' | 'major' | 'critical'
  resolved: boolean
}

const props = defineProps<{
  t: UiStrings
  locale: string
  items: Item[]
}>()

/** Пусто — показываем все: за сброс отвечает кнопка рядом. */
const since = ref('')

const visible = computed(() =>
  since.value === ''
    ? props.items
    : props.items.filter(item => item.date.slice(0, 10) >= since.value),
)

const date = new Intl.DateTimeFormat(props.locale, { dateStyle: 'long' })

const severityClass: Record<Item['severity'], string> = {
  minor: 'text-[var(--gr-info-text)] bg-[var(--gr-info-light)]',
  major: 'text-[var(--gr-warning-text)] bg-[var(--gr-warning-light)]',
  critical: 'text-[var(--gr-danger-text)] bg-[var(--gr-danger-light)]',
}

const severityLabel = computed<Record<Item['severity'], string>>(() => ({
  minor: props.t.severityMinor,
  major: props.t.severityMajor,
  critical: props.t.severityCritical,
}))
</script>

<template>
  <div data-testid="incidents-board" class="grid gap-6">
    <div class="flex flex-wrap items-end gap-3">
      <label class="grid content-start gap-1.5">
        <span class="text-sm font-medium text-[var(--gr-fg)]">{{ t.incidentsSince }}</span>
        <GrDatePicker v-model="since" data-testid="since-filter" size="sm" :aria-label="t.incidentsSince" />
      </label>
      <GrButton v-if="since" variant="ghost" size="sm" @click="since = ''">{{ t.incidentsAll }}</GrButton>
    </div>

    <p v-if="visible.length === 0" class="m-0 text-[var(--gr-muted-fg)]">{{ t.incidentsEmpty }}</p>

    <ul v-else class="m-0 grid list-none gap-4 p-0">
      <li
        v-for="item in visible"
        :key="item.slug"
        class="rounded-[var(--gr-radius-xl)] border border-[var(--gr-brd)] bg-[var(--gr-card)] p-5 shadow-[var(--gr-shadow-1)]"
      >
        <p class="m-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--gr-muted-fg)]">
          <time :datetime="item.date">{{ date.format(new Date(item.date)) }}</time>
          <span class="rounded-[var(--gr-radius-full)] px-2 py-0.5 text-xs font-medium" :class="severityClass[item.severity]">
            {{ severityLabel[item.severity] }}
          </span>
          <span class="rounded-[var(--gr-radius-full)] border border-[var(--gr-brd)] px-2 py-0.5 text-xs">
            {{ item.resolved ? t.incidentResolved : t.incidentOpen }}
          </span>
          <span class="font-mono text-xs">{{ item.service }}</span>
        </p>
        <h2 class="m-0 mt-2 text-xl font-semibold tracking-tight">
          <a
            :href="item.href"
            class="rounded-[var(--gr-radius-sm)] text-[var(--gr-fg)] no-underline hover:text-[var(--gr-primary-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gr-ring)]"
          >{{ item.title }}</a>
        </h2>
        <p class="m-0 mt-1.5 text-[var(--gr-muted-fg)]">{{ item.summary }}</p>
      </li>
    </ul>
  </div>
</template>
