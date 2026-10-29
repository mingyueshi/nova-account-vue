<script setup lang="ts">
import { useId } from 'vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    as?: 'input' | 'textarea'
    type?: string
    maxlength?: number
    error?: string
    hint?: string
    autocomplete?: string
    disabled?: boolean
  }>(),
  { as: 'input', type: 'text', error: '', hint: '', disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
defineSlots<{ prefix?(): unknown; suffix?(): unknown }>()
const id = useId()
</script>
<template>
  <div class="na:grid na:gap-2">
    <label :for="id" class="na:text-sm na:font-medium">{{ label }}</label>
    <div class="na:flex na:min-w-0 na:items-center na:gap-2">
      <slot name="prefix" />
      <component
        :is="as"
        v-bind="$attrs"
        :id="id"
        :value="props.modelValue"
        :type="as === 'input' ? type : undefined"
        :maxlength="maxlength"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
        class="na:min-h-12 na:w-full na:min-w-0 na:rounded-xl na:border na:border-[var(--na-control)] na:bg-[var(--na-surface)] na:px-3.5 na:py-3 na:text-base na:text-[var(--na-ink)] na:placeholder:text-[var(--na-muted)] na:focus:border-[var(--na-brand)] na:disabled:opacity-50"
        @input="
          emit('update:modelValue', ($event.target as HTMLInputElement | HTMLTextAreaElement).value)
        "
      />
      <slot name="suffix" />
    </div>
    <p v-if="error" :id="`${id}-error`" role="alert" class="na:text-xs na:text-[var(--na-error)]">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="na:text-xs na:text-[var(--na-muted)]">
      {{ hint }}
    </p>
  </div>
</template>
