<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { nextTick, onMounted, ref, useId, watch } from 'vue'
import type { Challenge } from '../types'
import NovaButton from './NovaButton.vue'
import NovaIcon from './NovaIcon.vue'

const { t } = useNovaLocale()
const props = withDefaults(
  defineProps<{ challenge: Challenge; busy?: boolean; error?: string; simulated?: boolean }>(),
  { busy: false, error: '', simulated: false },
)
const emit = defineEmits<{ submit: [response: { value: number }]; retry: [] }>()
const id = useId()
const value = ref(0)
const localError = ref('')
const slider = ref<HTMLInputElement>()
const status = ref<HTMLElement>()
let drag: { pointerId: number; x: number; value: number; travel: number } | undefined
function submit() {
  if (props.busy) return
  if (value.value !== 100) {
    localError.value = t('captcha.moveFirst')
    return
  }
  localError.value = ''
  emit('submit', { value: value.value })
}
function pointerStart(event: PointerEvent) {
  if (drag || props.busy || event.button !== 0 || event.isPrimary === false) return
  event.preventDefault()
  const input = slider.value!
  input.focus({ preventScroll: true })
  const bounds = input.getBoundingClientRect()
  // The 44px visible thumb has a 2px gutter inside the 48px native hit area.
  const travel = Math.max(1, bounds.width - 48)
  if (Math.abs(event.clientX - bounds.left - 24 - (travel * value.value) / 100) > 24) return
  drag = { pointerId: event.pointerId, x: event.clientX, value: value.value, travel }
  input.setPointerCapture?.(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId || props.busy) return
  value.value = Math.max(
    0,
    Math.min(100, drag.value + ((event.clientX - drag.x) * 100) / drag.travel),
  )
  localError.value = ''
}
function pointerFinish(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return
  pointerMove(event)
  cancelDrag()
  if (value.value === 100) submit()
}
function cancelDrag() {
  drag = undefined
}
watch(
  () => props.challenge.id,
  () => {
    value.value = 0
    localError.value = ''
    cancelDrag()
  },
)
watch(
  () => props.busy,
  async (busy) => {
    if (busy) {
      cancelDrag()
      await nextTick()
      status.value?.focus({ preventScroll: true })
    }
  },
)
onMounted(() => slider.value?.focus({ preventScroll: true }))
</script>

<template>
  <div class="nova-captcha na:grid na:gap-3" :aria-busy="busy">
    <label :for="id" class="na:sr-only">{{ challenge.label || t('captcha.label') }}</label>
    <div
      class="nova-captcha-track"
      :data-ready="value === 100"
      :style="{ '--na-captcha-progress': value / 100 }"
    >
      <span class="nova-captcha-fill" aria-hidden="true" />
      <span class="nova-captcha-target" aria-hidden="true"
        ><NovaIcon name="chevron" :size="16"
      /></span>
      <span v-show="!value || busy" class="nova-captcha-prompt" aria-hidden="true">{{
        busy ? t('captcha.busy') : t('captcha.prompt')
      }}</span>
      <span class="nova-captcha-thumb" aria-hidden="true" data-captcha-thumb>
        <NovaIcon :name="busy ? 'clock' : 'forward'" :size="18" />
      </span>
      <input
        :id="id"
        ref="slider"
        v-model.number="value"
        type="range"
        min="0"
        max="100"
        step="any"
        :disabled="busy"
        :aria-invalid="error || localError ? true : undefined"
        class="nova-captcha-range"
        :aria-valuetext="t('captcha.value', { value: Math.round(value) })"
        :aria-describedby="`${id}-help${error || localError ? ` ${id}-error` : ''}`"
        @input="localError = ''"
        @pointerdown="pointerStart"
        @pointermove="pointerMove"
        @pointerup="pointerFinish"
        @pointercancel="cancelDrag"
        @lostpointercapture="cancelDrag"
        @keydown.enter.prevent="submit"
      />
    </div>
    <p :id="`${id}-help`" class="na:sr-only">{{ t('captcha.help') }}</p>
    <p
      v-if="error || localError"
      :id="`${id}-error`"
      class="na:text-sm na:text-[var(--na-error)]"
      role="alert"
    >
      {{ error || localError }}
    </p>
    <p ref="status" tabindex="-1" role="status" class="na:sr-only">
      {{ busy ? t('captcha.busy') : '' }}
    </p>
    <NovaButton v-if="error" variant="secondary" :disabled="busy" @click="emit('retry')">{{
      t('common.retry')
    }}</NovaButton>
  </div>
</template>
