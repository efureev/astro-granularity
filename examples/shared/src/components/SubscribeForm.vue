<script setup lang="ts">
/**
 * Подписка на оповещения — серверный остров с настоящей валидацией.
 *
 * Правила объявлены по имени поля и живут в `GrForm`; контролы о форме не знают.
 * Тексты ошибок приходят из строк **ядра** (`gr.form.*`), поэтому переводятся
 * механикой пакета, а не руками.
 */
import type { Service } from '../data/services'
import type { UiStrings } from '../i18n/ui'
import { computed, reactive, ref } from 'vue'
import { GrButton } from '@feugene/granularity/components/GrButton'
import { GrCard } from '@feugene/granularity/components/GrCard'
import { GrForm } from '@feugene/granularity/components/GrForm'
import { GrFormField } from '@feugene/granularity/components/GrFormField'
import { GrInput } from '@feugene/granularity/components/GrInput'
import { GrSelect } from '@feugene/granularity/components/GrSelect'
import { SUBSCRIPTION_KEY } from '../data/preferences'

const props = defineProps<{
  t: UiStrings
  services: Service[]
}>()

const model = reactive({
  email: '',
  services: [] as string[],
  frequency: 'instant',
})

const rules = computed(() => ({
  // `type: 'email'` даёт готовое сообщение из словаря ядра — своё писать незачем.
  email: [{ required: true, type: 'email' as const }],
  // Массив: `min` меряет длину. Сообщение своё — «не короче 1» звучало бы дико.
  services: [{ required: true, min: 1, message: props.t.errorPickService }],
  frequency: [{ required: true }],
}))

const serviceOptions = computed(() =>
  props.services.map(service => ({ value: service.id, label: service.name })),
)

const frequencyOptions = computed(() => [
  { value: 'instant', label: props.t.freqInstant },
  { value: 'daily', label: props.t.freqDaily },
  { value: 'weekly', label: props.t.freqWeekly },
])

const sending = ref(false)
const done = ref(false)

/**
 * Отправки на сервер нет и быть не может: сборка статическая. Задержка здесь
 * не для вида — она показывает состояние `loading` у кнопки, ради которого
 * половина форм и ломается.
 */
async function submit() {
  sending.value = true
  done.value = false
  try {
    await new Promise(resolve => setTimeout(resolve, 600))
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify({ ...model }))
    done.value = true
  }
  catch {
    // Приватный режим Safari бросает на записи. Подписка при этом не оформлена,
    // и говорить обратное нельзя.
    done.value = false
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <GrCard variant="outlined" padding="lg">
    <h2 class="m-0 text-lg font-semibold tracking-tight text-[var(--gr-fg)]">{{ t.subscribeTitle }}</h2>
    <p class="m-0 mt-1.5 text-sm text-[var(--gr-muted-fg)]">{{ t.subscribeDescription }}</p>

    <GrForm class="mt-6 grid gap-5" :model="model" :rules="rules" @submit="submit">
      <GrFormField name="email" :label="t.fieldEmail" :hint="t.fieldEmailHint" required>
        <GrInput v-model="model.email" data-testid="sub-email" type="email" autocomplete="email" />
      </GrFormField>

      <GrFormField name="services" :label="t.fieldServices" :hint="t.fieldServicesHint" required>
        <GrSelect
          v-model="model.services"
          data-testid="sub-services"
          multiple
          tags
          options-view="panel"
          :options="serviceOptions"
        />
      </GrFormField>

      <GrFormField name="frequency" :label="t.fieldFrequency" required>
        <GrSelect v-model="model.frequency" data-testid="sub-frequency" :options="frequencyOptions" />
      </GrFormField>

      <div class="flex flex-wrap items-center gap-3 border-t border-[var(--gr-brd)] pt-5">
        <GrButton type="submit" data-testid="sub-submit" :loading="sending" :loading-text="t.subscribing">
          {{ t.actionSubscribe }}
        </GrButton>
        <p v-if="done" role="status" data-testid="sub-done" class="m-0 text-sm text-[var(--gr-success-text)]">
          {{ t.subscribed }}
        </p>
      </div>
    </GrForm>
  </GrCard>
</template>
