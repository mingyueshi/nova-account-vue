<script setup lang="ts">
import { watch } from 'vue'
import { parseAppearance, useAppearance } from '../composables/useAppearance'
import type { Appearance } from '../types'
import { provideNovaLocale } from '../locale'
import type { NovaLocaleOptions } from '../locale'
const props = withDefaults(
  defineProps<NovaLocaleOptions & { modelValue?: Appearance; storageKey?: string | false }>(),
  { storageKey: false },
)
const i18n = provideNovaLocale(() => props)
const emit = defineEmits<{ 'update:modelValue': [appearance: Appearance] }>()
const theme = useAppearance({
  initial: props.modelValue,
  storageKey: props.storageKey,
  onChange: (value) => emit('update:modelValue', value),
})
// Controlled prop synchronization is silent: never echo an update into v-model.
watch(
  () => props.modelValue,
  (value) => {
    const validated = parseAppearance(value)
    if (
      validated &&
      (validated.mode !== theme.appearance.value.mode ||
        validated.accent !== theme.appearance.value.accent)
    )
      theme.appearance.value = validated
  },
  { deep: true },
)
defineSlots<{
  default(props: {
    appearance: Appearance
    setAppearance: typeof theme.setAppearance
    storageError: string
  }): unknown
}>()
</script>
<template>
  <div
    class="nova-account"
    :lang="i18n.locale.value"
    :data-theme="theme.resolvedMode.value"
    :data-accent="theme.appearance.value.accent"
  >
    <slot
      :appearance="theme.appearance.value"
      :set-appearance="theme.setAppearance"
      :storage-error="theme.storageError.value ? i18n.t('appearance.storageError') : ''"
    />
  </div>
</template>
