<script setup lang="ts">
import { computed, type Component } from 'vue'
import { resolveNovaIcon } from '../icons'
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    name?: string
    icon?: Component
    fallback?: string
    size?: number
    strokeWidth?: number
    color?: string
    label?: string
  }>(),
  { name: '', size: 20, strokeWidth: 2, color: 'currentColor', label: '' },
)
const component = computed(() => props.icon ?? resolveNovaIcon(props.name))
</script>
<template>
  <component
    :is="component"
    v-if="component"
    class="nova-icon"
    :size="size"
    :stroke-width="strokeWidth"
    :color="color"
    :aria-hidden="label ? undefined : true"
    :aria-label="label || undefined"
    :role="label ? 'img' : undefined"
    focusable="false"
    v-bind="$attrs"
  />
  <span
    v-else
    :aria-hidden="label ? undefined : true"
    :aria-label="label || undefined"
    :role="label ? 'img' : undefined"
    v-bind="$attrs"
    >{{ fallback || '◇' }}</span
  >
</template>
