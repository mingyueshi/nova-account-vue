<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    type?: 'button' | 'submit' | 'reset'
    busy?: boolean
    disabled?: boolean
  }>(),
  { variant: 'secondary', type: 'button', busy: false, disabled: false },
)
defineSlots<{ default(): unknown }>()
</script>
<template>
  <button
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
    class="na:inline-flex na:min-h-11 na:items-center na:justify-center na:gap-2 na:rounded-xl na:border na:px-4 na:py-2.5 na:text-sm na:font-medium na:transition-colors na:disabled:cursor-not-allowed na:disabled:opacity-50"
    :class="
      variant === 'primary'
        ? 'na:border-transparent na:bg-[var(--na-brand)] na:text-[var(--na-on-brand)] na:hover:brightness-95'
        : variant === 'ghost'
          ? 'na:border-transparent na:bg-transparent na:text-[var(--na-muted)] na:hover:bg-[var(--na-soft)]'
          : 'na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:text-[var(--na-ink)] na:hover:bg-[var(--na-soft)]'
    "
  >
    <svg
      v-if="busy"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      class="na:motion-safe:animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.25" />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      /></svg
    ><slot />
  </button>
</template>
