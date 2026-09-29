<script setup lang="ts">
/**
 * Панель состояния — серверный остров.
 *
 * Отрисован на сервере и гидратирован: список сервисов это содержимое страницы,
 * оно обязано быть в разметке и без JS. Интерактив добавляет фильтр по среде —
 * от него пересчитываются и баннер, и три карточки.
 */
import type { Environment, Service } from '../data/services'
import type { UiStrings } from '../i18n/ui'
import { computed, ref } from 'vue'
import { GrButton } from '@feugene/granularity/components/GrButton'
import { GrCard } from '@feugene/granularity/components/GrCard'
import { GrDialog } from '@feugene/granularity/components/GrDialog'
import { GrSelect } from '@feugene/granularity/components/GrSelect'
import { GrTooltip } from '@feugene/granularity/components/GrTooltip'
import { summarize } from '../data/services'
import StatusDot from './StatusDot.vue'

const props = defineProps<{
  t: UiStrings
  locale: string
  services: Service[]
  environments: Environment[]
  incidentHrefs: Record<string, string>
  incidentReadLabel: string
  initialEnv: Environment
}>()

/** Пусто — «все среды»: за это отвечает `clearable` у фильтра. */
const env = ref<Environment | ''>(props.initialEnv)

const envOptions = computed(() =>
  props.environments.map(value => ({ value, label: value })),
)

const visible = computed(() =>
  env.value === '' ? props.services : props.services.filter(s => s.env === env.value),
)

const summary = computed(() => summarize(visible.value))

const statusLabel = computed(() => ({
  operational: props.t.statusOperational,
  degraded: props.t.statusDegraded,
  outage: props.t.statusOutage,
}))

const statusHint = computed(() => ({
  operational: props.t.statusHintOperational,
  degraded: props.t.statusHintDegraded,
  outage: props.t.statusHintOutage,
}))

const percent = new Intl.NumberFormat(props.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat(props.locale)
const date = new Intl.DateTimeFormat(props.locale, { dateStyle: 'long' })

const kpis = computed(() => [
  { label: props.t.kpiUptime, hint: props.t.kpiUptimeHint, value: `${percent.format(summary.value.uptime)}%`, unit: '' },
  { label: props.t.kpiLatency, hint: props.t.kpiLatencyHint, value: whole.format(summary.value.latency), unit: 'ms' },
  { label: props.t.kpiIncidents, hint: props.t.kpiIncidentsHint, value: whole.format(summary.value.incidents), unit: '' },
])

const open = ref(false)
const selected = ref<Service | null>(null)

function openDetails(service: Service) {
  selected.value = service
  open.value = true
}
</script>

<template>
  <div data-testid="service-board" class="grid gap-8">
    <!-- Баннер: цвет поддерживает текст, а не заменяет его. -->
    <section
      class="rounded-[var(--gr-radius-xl)] border px-5 py-4"
      :class="summary.healthy
        ? 'border-[var(--gr-success)]/40 bg-[var(--gr-success-light)]'
        : 'border-[var(--gr-warning)]/40 bg-[var(--gr-warning-light)]'"
    >
      <p
        class="m-0 flex items-center gap-2.5 text-lg font-semibold"
        :class="summary.healthy ? 'text-[var(--gr-success-text)]' : 'text-[var(--gr-warning-text)]'"
      >
        <span
          class="h-2.5 w-2.5 rounded-[var(--gr-radius-full)]"
          :class="summary.healthy ? 'bg-[var(--gr-success)]' : 'bg-[var(--gr-warning)]'"
          aria-hidden="true"
        />
        {{ summary.healthy ? t.bannerOperational : t.bannerDegraded }}
      </p>
      <p class="m-0 mt-1 text-sm" :class="summary.healthy ? 'text-[var(--gr-success-text)]' : 'text-[var(--gr-warning-text)]'">
        {{ t.bannerHint }}
      </p>
    </section>

    <section class="grid gap-4 sm:grid-cols-3">
      <!--
        Заголовок только для скринридера: визуально три карточки говорят за себя,
        но без него порядок заголовков ломается — `h1` страницы, затем сразу `h3`
        карточек. Это ловит и Lighthouse (`heading-order`).
      -->
      <h2 class="sr-only sm:col-span-3">{{ t.kpiSectionTitle }}</h2>
      <GrCard v-for="kpi in kpis" :key="kpi.label" variant="outlined" padding="md">
        <div class="flex items-center gap-1.5">
          <h3 class="m-0 text-sm font-medium text-[var(--gr-muted-fg)]">{{ kpi.label }}</h3>
          <!-- Подсказка вместо описания: описание в две строки сдвигало бы
               значение вниз только в той карточке, где оно длиннее. -->
          <GrTooltip :text="kpi.hint" size="sm" placement="top" :open-delay="150" />
        </div>
        <p class="m-0 mt-2 text-3xl font-semibold tabular-nums text-[var(--gr-fg)]">
          {{ kpi.value }}<span v-if="kpi.unit" class="ml-1 text-lg font-normal text-[var(--gr-muted-fg)]">{{ kpi.unit }}</span>
        </p>
      </GrCard>
    </section>

    <section class="grid gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h2 class="m-0 text-xl font-semibold tracking-tight text-[var(--gr-fg)]">{{ t.servicesTitle }}</h2>
        <!--
          Панель, а не нативный `<select>`: с поиском и очисткой. Очистка здесь
          осмысленна — пустое значение означает «все среды», а не «ничего».
        -->
        <div class="w-full sm:w-56">
          <GrSelect
            v-model="env"
            data-testid="env-filter"
            options-view="panel"
            filterable
            clearable
            size="sm"
            :options="envOptions"
            :placeholder="t.envAll"
            :aria-label="t.envLabel"
          />
        </div>
      </div>

      <GrCard variant="outlined" padding="none">
        <ul v-if="visible.length > 0" class="m-0 list-none p-0">
          <li
            v-for="(service, index) in visible"
            :key="service.id"
            class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
            :class="index > 0 ? 'border-t border-[var(--gr-brd)]' : ''"
          >
            <span class="min-w-40 flex-1 font-medium text-[var(--gr-fg)]">{{ service.name }}</span>
            <!--
              Фиксированная ширина у среды и статуса: без неё каждая строка —
              свой flex, и колонки разъезжаются вслед за длиной имени сервиса.
              До `sm` ширина не задаётся — там строки переносятся.
            -->
            <span class="font-mono text-xs text-[var(--gr-muted-fg)] sm:w-16 sm:text-right">{{ service.env }}</span>
            <StatusDot
              class="sm:w-44"
              :status="service.status"
              :label="statusLabel[service.status]"
              :hint="statusHint[service.status]"
            />
            <GrButton
              data-testid="service-details"
              variant="outline"
              size="sm"
              class="ml-auto"
              @click="openDetails(service)"
            >{{ t.detailsAction }}</GrButton>
          </li>
        </ul>
        <p v-else class="m-0 px-5 py-8 text-center text-sm text-[var(--gr-muted-fg)]">{{ t.emptyServices }}</p>
      </GrCard>
    </section>

    <GrDialog v-model="open" :title="selected?.name" size="sm" :close-label="t.dialogClose">
      <dl v-if="selected" data-testid="dialog-body" class="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        <dt class="text-[var(--gr-muted-fg)]">{{ t.dialogRegion }}</dt>
        <dd class="m-0 text-right font-mono text-[var(--gr-fg)]">{{ selected.region }}</dd>
        <dt class="text-[var(--gr-muted-fg)]">{{ t.dialogUptime }}</dt>
        <dd class="m-0 text-right tabular-nums text-[var(--gr-fg)]">{{ percent.format(selected.uptime) }}%</dd>
        <dt class="text-[var(--gr-muted-fg)]">{{ t.dialogLatency }}</dt>
        <dd class="m-0 text-right tabular-nums text-[var(--gr-fg)]">{{ whole.format(selected.latency) }} ms</dd>
        <dt class="text-[var(--gr-muted-fg)]">{{ t.dialogLastIncident }}</dt>
        <dd class="m-0 text-right text-[var(--gr-fg)]">
          <a
            v-if="selected.lastIncident && incidentHrefs[selected.id]"
            :href="incidentHrefs[selected.id]"
            data-testid="incident-link"
            class="text-[var(--gr-primary-text)] underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gr-ring)] rounded-[var(--gr-radius-sm)]"
          >{{ date.format(new Date(selected.lastIncident)) }}</a>
          <template v-else-if="selected.lastIncident">{{ date.format(new Date(selected.lastIncident)) }}</template>
          <template v-else>{{ t.dialogNoIncidents }}</template>
        </dd>
      </dl>
    </GrDialog>
  </div>
</template>
