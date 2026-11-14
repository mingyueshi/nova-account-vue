<script setup lang="ts">
import { computed, useAttrs, useId, useSlots } from 'vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    id?: string
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
const generatedId = useId()
const id = computed(() => props.id ?? generatedId)
const attrs = useAttrs()
const describedBy = () =>
  [
    attrs['aria-describedby'],
    props.error ? `${id.value}-error` : props.hint ? `${id.value}-hint` : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined
const slots = useSlots()
const affixed = () => !!(slots.prefix || slots.suffix)
</script>
<template>
  <div class="nova-field na:grid na:gap-2">
    <label :for="id" class="na:text-sm na:font-medium">{{ label }}</label>
    <div
      class="na:flex na:min-w-0 na:items-center na:gap-2"
      :class="
        affixed()
          ? [
              'nova-field-affixed na:rounded-xl na:border na:bg-[var(--na-surface)] na:px-3.5',
              error ? 'na:border-[var(--na-error)]' : 'na:border-[var(--na-control)]',
            ]
          : undefined
      "
    >
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
        :aria-describedby="describedBy()"
        class="na:min-h-12 na:w-full na:min-w-0 na:py-3 na:text-base na:text-[var(--na-ink)] na:placeholder:text-[var(--na-muted)] na:disabled:opacity-50"
        :class="
          affixed()
            ? 'na:border-0 na:bg-transparent na:px-0'
            : [
                'na:rounded-xl na:border na:bg-[var(--na-surface)] na:px-3.5 na:focus:border-[var(--na-brand)]',
                error ? 'na:border-[var(--na-error)]' : 'na:border-[var(--na-control)]',
              ]
        "
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
