<script setup lang="ts">
/**
 * Форма предпочтений — серверный остров.
 *
 * Отрисована на сервере с умолчаниями, поэтому видна и без JS. Сохранённые
 * значения подставляются после монтирования: до него их знать неоткуда.
 */
import type { Environment } from '../data/services'
import type { UiStrings } from '../i18n/ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { GrButton } from '@feugene/granularity/components/GrButton'
import { GrCard } from '@feugene/granularity/components/GrCard'
import { GrDialog } from '@feugene/granularity/components/GrDialog'
import { GrSelect } from '@feugene/granularity/components/GrSelect'
import { defaultPreferences, PREFERENCES_CHANGED, PREFERENCES_KEY, readPreferences } from '../data/preferences'

const props = defineProps<{
  t: UiStrings
  environments: Environment[]
}>()

/**
 * Острова — независимые корни Vue, общего состояния у них нет. Соседняя
 * карточка «сохранено в этом браузере» узнаёт о правке только событием окна.
 */
function announce() {
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED))
}

const env = ref(defaultPreferences.env)
const density = ref(defaultPreferences.density)
const notify = ref(defaultPreferences.notify)

const savedNotice = ref(false)
const confirmReset = ref(false)

/**
 * Уведомление гаснет само.
 *
 * Постоянная «Сохранено» перестаёт что-либо значить через минуту после
 * сохранения: она сообщает не о результате действия, а о том, что действие
 * когда-то было. Таймер сбрасывается при повторном сохранении, иначе второе
 * уведомление погасло бы по расписанию первого.
 */
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function showSavedNotice() {
  savedNotice.value = true
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { savedNotice.value = false }, 4000)
}

onUnmounted(() => clearTimeout(noticeTimer))

onMounted(() => {
  const stored = readPreferences()
  if (!stored)
    return
  env.value = stored.env
  density.value = stored.density
  notify.value = stored.notify
})

const densityOptions = [
  { value: 'compact', label: props.t.densityCompact },
  { value: 'cosy', label: props.t.densityCosy },
  { value: 'roomy', label: props.t.densityRoomy },
]

const notifyOptions = [
  { value: 'all', label: props.t.notifyAll },
  { value: 'incidents', label: props.t.notifyIncidents },
  { value: 'none', label: props.t.notifyNone },
]

function persist() {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
      env: env.value,
      density: density.value,
      notify: notify.value,
    }))
    showSavedNotice()
    announce()
  }
  catch {
    // Запись бросает в приватном режиме Safari. Молчать нельзя, но и ронять
    // страницу не за что: уведомление просто не появится.
    savedNotice.value = false
  }
}

function reset() {
  try {
    localStorage.removeItem(PREFERENCES_KEY)
  }
  catch {}
  env.value = defaultPreferences.env
  density.value = defaultPreferences.density
  notify.value = defaultPreferences.notify
  clearTimeout(noticeTimer)
  savedNotice.value = false
  confirmReset.value = false
  announce()
}
</script>

<template>
  <GrCard variant="outlined" padding="lg">
    <form class="grid gap-6" @submit.prevent="persist">
      <!--
        `content-start` на каждом поле: поля одной строки грида растягиваются до
        высоты самого высокого, и подсказка в две строки у соседа сделала бы
        селект выше остальных.
      -->
      <div class="grid gap-5 md:grid-cols-3">
        <label class="grid content-start gap-1.5">
          <span class="text-sm font-medium text-[var(--gr-fg)]">{{ t.fieldEnv }}</span>
          <GrSelect
            v-model="env"
            data-testid="pref-env"
            :options="environments.map(value => ({ value, label: value }))"
            :aria-label="t.fieldEnv"
          />
          <span class="text-xs text-[var(--gr-muted-fg)]">{{ t.fieldEnvHint }}</span>
        </label>

        <label class="grid content-start gap-1.5">
          <span class="text-sm font-medium text-[var(--gr-fg)]">{{ t.fieldDensity }}</span>
          <GrSelect v-model="density" :options="densityOptions" :aria-label="t.fieldDensity" />
          <span class="text-xs text-[var(--gr-muted-fg)]">{{ t.fieldDensityHint }}</span>
        </label>

        <label class="grid content-start gap-1.5">
          <span class="text-sm font-medium text-[var(--gr-fg)]">{{ t.fieldNotify }}</span>
          <GrSelect v-model="notify" :options="notifyOptions" :aria-label="t.fieldNotify" />
          <span class="text-xs text-[var(--gr-muted-fg)]">{{ t.fieldNotifyHint }}</span>
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-3 border-t border-[var(--gr-brd)] pt-5">
        <GrButton type="submit" data-testid="pref-save">{{ t.actionSave }}</GrButton>
        <GrButton variant="outline" tone="danger" data-testid="pref-reset" @click="confirmReset = true">
          {{ t.actionReset }}
        </GrButton>
        <!-- `role="status"` — уведомление читается вслух, но не перебивает. -->
        <p v-if="savedNotice" role="status" class="m-0 text-sm text-[var(--gr-success-text)]">{{ t.saved }}</p>
      </div>
    </form>

    <GrDialog v-model="confirmReset" :title="t.resetTitle" size="sm" :close-label="t.dialogClose">
      <p class="m-0 text-sm text-[var(--gr-muted-fg)]">{{ t.resetBody }}</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <GrButton variant="outline" @click="confirmReset = false">{{ t.resetCancel }}</GrButton>
          <GrButton tone="danger" data-testid="pref-reset-confirm" @click="reset">{{ t.resetConfirm }}</GrButton>
        </div>
      </template>
    </GrDialog>
  </GrCard>
</template>
