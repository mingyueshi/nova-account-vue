<script setup lang="ts">
import { computed, useId } from 'vue'
import { useNovaLocale } from '../locale'
import type { Accent, Appearance, ThemeMode } from '../types'
import NovaButton from './NovaButton.vue'
const { t } = useNovaLocale()
const id = useId()
const props = defineProps<{ modelValue: Appearance; storageError?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Appearance] }>()
const modes = computed<{ id: ThemeMode; label: string; icon: string }[]>(() => [
  { id: 'light', label: t('appearance.light'), icon: '☀' },
  { id: 'dark', label: t('appearance.dark'), icon: '☾' },
  { id: 'system', label: t('appearance.system'), icon: '◐' },
])
const accents = computed<{ id: Accent; label: string; color: string }[]>(() => [
  { id: 'iris', label: t('appearance.iris'), color: '#6958c5' },
  { id: 'blue', label: t('appearance.blue'), color: '#346bbd' },
  { id: 'teal', label: t('appearance.teal'), color: '#217560' },
  { id: 'amber', label: t('appearance.amber'), color: '#956100' },
])
function update(value: Partial<Appearance>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}
</script>
<template>
  <section class="na:grid na:gap-7" :aria-label="t('appearance.title')">
    <fieldset class="na:m-0 na:min-w-0 na:border-0 na:p-0">
      <legend class="na:mb-3 na:text-sm na:font-semibold">{{ t('appearance.mode') }}</legend>
      <div class="na:grid na:grid-cols-3 na:gap-2">
        <label
          v-for="mode in modes"
          :key="mode.id"
          class="na:relative na:cursor-pointer na:focus-within:outline-2 na:focus-within:outline-offset-2 na:focus-within:outline-[var(--na-brand)] na:rounded-xl na:border na:border-[var(--na-line)] na:p-4 na:text-left na:hover:bg-[var(--na-soft)]"
          :class="
            modelValue.mode === mode.id
              ? 'na:bg-[var(--na-soft)] na:text-[var(--na-brand)]'
              : 'na:bg-[var(--na-surface)]'
          "
        >
          <input
            type="radio"
            class="na:sr-only"
            :name="`${id}-mode`"
            :value="mode.id"
            :checked="modelValue.mode === mode.id"
            @change="update({ mode: mode.id })"
          />
          <span class="na:mb-3 na:block na:text-2xl" aria-hidden="true">{{ mode.icon }}</span
          ><span class="na:text-xs na:font-medium"
            >{{ mode.label }}
            <span aria-hidden="true">{{ modelValue.mode === mode.id ? '✓' : '' }}</span></span
          >
        </label>
      </div>
    </fieldset>
    <fieldset class="na:m-0 na:min-w-0 na:border-0 na:p-0">
      <legend class="na:mb-3 na:text-sm na:font-semibold">{{ t('appearance.accent') }}</legend>
      <div class="na:grid na:grid-cols-2 na:gap-2 na:sm:grid-cols-4">
        <label
          v-for="accent in accents"
          :key="accent.id"
          class="na:relative na:cursor-pointer na:focus-within:outline-2 na:focus-within:outline-offset-2 na:focus-within:outline-[var(--na-brand)] na:flex na:min-h-12 na:items-center na:gap-2 na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-3 na:py-3 na:text-xs"
          :class="modelValue.accent === accent.id ? 'na:text-[var(--na-brand)]' : ''"
        >
          <input
            type="radio"
            class="na:sr-only"
            :name="`${id}-accent`"
            :value="accent.id"
            :checked="modelValue.accent === accent.id"
            @change="update({ accent: accent.id })"
          /><span
            class="na:size-3 na:shrink-0 na:rounded-full"
            :style="{ background: accent.color }"
            aria-hidden="true"
          />{{ accent.label }}
          <span aria-hidden="true">{{ modelValue.accent === accent.id ? '✓' : '' }}</span></label
        >
      </div>
    </fieldset>
    <div class="na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-soft)] na:p-5">
      <p class="na:mb-1 na:font-medium">{{ t('appearance.previewTitle') }}</p>
      <p class="na:text-sm na:text-[var(--na-muted)]">{{ t('appearance.previewText') }}</p>
      <NovaButton variant="primary" class="na:mt-4" tabindex="-1">{{
        t('appearance.button')
      }}</NovaButton>
    </div>
    <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-3">
      <p class="na:text-xs na:text-[var(--na-muted)]">
        {{ storageError || t('appearance.storageHint') }}
      </p>
      <NovaButton variant="ghost" @click="update({ mode: 'light', accent: 'iris' })">{{
        t('appearance.reset')
      }}</NovaButton>
    </div>
  </section>
</template>
