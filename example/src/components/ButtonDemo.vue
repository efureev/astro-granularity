<script setup lang="ts">
import { ref } from 'vue'
import { GrButton } from '@feugene/granularity/components/GrButton'

const clicks = ref(0)
</script>

<template>
  <div data-testid="island">
    <GrButton variant="primary" @click="clicks++">
      Clicked {{ clicks }}
    </GrButton>
  </div>
</template>
