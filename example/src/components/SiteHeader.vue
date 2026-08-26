<script setup lang="ts">
/**
 * Шапка сайта — серверный остров.
 *
 * Разметка обязана быть в HTML: это навигация, её читают поисковики и она нужна
 * без JS. Интерактив здесь один — выбор языка.
 */
import { ref, watch } from 'vue'
import { GrSelect } from '@feugene/granularity/components/GrSelect'

type LocaleLink = { value: string, label: string, href: string }

const props = defineProps<{
  siteName: string
  navLabel: string
  nav: { label: string, href: string, current: boolean }[]
  localeLabel: string
  localeLinks: LocaleLink[]
  currentLocale: string
}>()

const selected = ref(props.currentLocale)

/**
 * Смена языка — переход, а не состояние: страницы статические, и у каждого
 * языка свой URL. Ведём на ту же страницу, чтобы выбор языка не терял место.
 *
 * Слежение за моделью, а не `@change`: в режиме `native` — а он у `GrSelect`
 * по умолчанию — событие `change` не эмитится вовсе, нативный обработчик шлёт
 * только `update:modelValue`. `@change` там молча не срабатывает.
 */
watch(selected, (value) => {
  const next = props.localeLinks.find(link => link.value === value)
  if (next && next.href !== window.location.pathname)
    window.location.href = next.href
})
</script>

<template>
  <!--
    Фон именно `--page-bg`, а не `--gr-card`: шапка липкая и обязана быть
    непрозрачной, а гейт первого кадра меряет пиксель (0, 0) — под шапкой.
  -->
  <header class="sticky top-0 z-[900] border-b border-[var(--gr-brd)] bg-[var(--page-bg)]">
    <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 lg:gap-6 lg:px-8">
      <a
        :href="nav[0]?.href ?? '/'"
        class="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-[var(--gr-fg)] rounded-[var(--gr-radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gr-ring)]"
      >
        <span class="grid h-7 w-7 place-items-center rounded-[var(--gr-radius-md)] bg-[var(--gr-primary)] text-[var(--gr-primary-fg)]">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12h4l3 7 4-14 3 7h4" />
          </svg>
        </span>
        <span class="hidden sm:inline">{{ siteName }}</span>
      </a>

      <nav :aria-label="navLabel" class="flex items-center gap-1">
        <a
          v-for="item in nav"
          :key="item.href"
          :href="item.href"
          :aria-current="item.current ? 'page' : undefined"
          class="rounded-[var(--gr-radius-md)] px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gr-ring)]"
          :class="item.current
            ? 'bg-[var(--gr-muted)] font-medium text-[var(--gr-fg)]'
            : 'text-[var(--gr-muted-fg)] hover:bg-[var(--gr-muted)] hover:text-[var(--gr-fg)]'"
        >{{ item.label }}</a>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <!--
          Нативный `<select>`, а не панель: на мобильном это системное колесо,
          а список из трёх пунктов ничего не выигрывает от кастомной панели.
          Панель показана рядом — на фильтре сред.
        -->
        <GrSelect
          v-model="selected"
          data-testid="locale-switcher"
          size="sm"
          :options="localeLinks.map(({ value, label }) => ({ value, label }))"
          :aria-label="localeLabel"
        />
        <slot name="theme" />
      </div>
    </div>
  </header>
</template>
