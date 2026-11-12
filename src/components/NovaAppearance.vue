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
  { id: 'blue', label: t('accent.blue'), color: '#1d4ed8' },
  { id: 'teal', label: t('accent.teal'), color: '#0f766e' },
  { id: 'indigo', label: t('accent.indigo'), color: '#4338ca' },
  { id: 'violet', label: t('accent.violet'), color: '#6d28d9' },
  { id: 'terracotta', label: t('accent.terracotta'), color: '#9a3412' },
  { id: 'graphite', label: t('accent.graphite'), color: '#3f3f46' },
  { id: 'midnight', label: t('accent.midnight'), color: '#1e40af' },
  { id: 'forest', label: t('accent.forest'), color: '#24613b' },
  { id: 'amber', label: t('accent.amber'), color: '#8a4b0f' },
  { id: 'ocean', label: t('accent.ocean'), color: '#0e647c' },
  { id: 'slate', label: t('accent.slate'), color: '#475569' },
  { id: 'plum', label: t('accent.plum'), color: '#803e73' },
  { id: 'coffee', label: t('accent.coffee'), color: '#73513e' },
  { id: 'glacier', label: t('accent.glacier'), color: '#245aa8' },
  { id: 'rose', label: t('accent.rose'), color: '#9b3658' },
  { id: 'olive', label: t('accent.olive'), color: '#536722' },
  { id: 'ink', label: t('accent.ink'), color: '#465064' },
  { id: 'cinnabar', label: t('accent.cinnabar'), color: '#b4342b' },
  { id: 'gilded', label: t('accent.gilded'), color: '#8f5c06' },
  { id: 'emerald', label: t('accent.emerald'), color: '#047857' },
  { id: 'peacock', label: t('accent.peacock'), color: '#0c6da3' },
  { id: 'sunset', label: t('accent.sunset'), color: '#ab2f6f' },
  { id: 'industrial', label: t('accent.industrial'), color: '#b03a0a' },
  { id: 'lilac', label: t('accent.lilac'), color: '#a1359e' },
  { id: 'terminal', label: t('accent.terminal'), color: '#1f7a33' },
  { id: 'parchment', label: t('accent.parchment'), color: '#7c5f33' },
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
      <div class="na:grid na:grid-cols-2 na:gap-2 na:sm:grid-cols-5">
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
      <NovaButton variant="ghost" @click="update({ mode: 'light', accent: 'blue' })">{{
        t('appearance.reset')
      }}</NovaButton>
    </div>
  </section>
</template>
