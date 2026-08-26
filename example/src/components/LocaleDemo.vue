<script setup lang="ts">
/**
 * Фикстура гейта строк: `GrPagination` рендерит подписи из словаря ядра сразу,
 * без взаимодействия и без открытия панелей.
 *
 * Компонент взят из списка «полностью изоморфных» (`granularity/docs/ssr.md`) —
 * значит проверка меряет строки, а не гидратацию оверлея.
 */
import { ref } from 'vue'
import { GrPagination } from '@feugene/granularity/components/GrPagination'

const page = ref(2)
</script>

<template>
  <div data-testid="locale-demo">
    <GrPagination v-model="page" :total="50" :page-size="10" />
  </div>
</template>
