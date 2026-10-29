<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { nextTick, onMounted, ref, useId, watch } from 'vue'
import type { Challenge } from '../types'
import NovaButton from './NovaButton.vue'

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
function submit() {
  if (props.busy) return
  if (value.value !== 100) {
    localError.value = t('captcha.moveFirst')
    return
  }
  localError.value = ''
  emit('submit', { value: value.value })
}
function pointerFinish() {
  if (value.value === 100) submit()
}
watch(
  () => props.challenge.id,
  () => {
    value.value = 0
    localError.value = ''
  },
)
watch(
  () => props.busy,
  async (busy) => {
    if (busy) {
      await nextTick()
      status.value?.focus({ preventScroll: true })
    }
  },
)
onMounted(() => slider.value?.focus({ preventScroll: true }))
</script>

<template>
  <div class="na:grid na:gap-5" :aria-busy="busy">
    <div
      class="na:relative na:h-28 na:overflow-hidden na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-soft)]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 112" class="na:h-full na:w-full" preserveAspectRatio="xMidYMid slice">
        <circle cx="250" cy="27" r="17" fill="var(--na-brand)" opacity=".16" />
        <path d="M0 112 68 33 139 112Z" fill="var(--na-brand)" opacity=".13" />
        <path d="M74 112 176 18 285 112Z" fill="var(--na-brand)" opacity=".2" />
        <path d="m202 112 62-63 56 63Z" fill="var(--na-brand)" opacity=".1" />
      </svg>
      <span class="na:absolute na:bottom-3 na:left-4 na:text-xs na:text-[var(--na-muted)]">{{
        challenge.label || t('captcha.prompt')
      }}</span>
    </div>
    <div class="na:grid na:gap-3">
      <label :for="id" class="na:text-sm na:font-medium">{{ t('captcha.label') }}</label>
      <input
        :id="id"
        ref="slider"
        v-model.number="value"
        type="range"
        min="0"
        max="100"
        step="1"
        :disabled="busy"
        class="na:h-11 na:w-full na:cursor-pointer na:accent-[var(--na-brand)] na:disabled:cursor-wait"
        :aria-valuetext="t('captcha.value', { value })"
        :aria-describedby="`${id}-help ${id}-error`"
        @input="localError = ''"
        @pointerup="pointerFinish"
        @keydown.enter.prevent="submit"
      />
      <p :id="`${id}-help`" class="na:text-xs na:leading-relaxed na:text-[var(--na-muted)]">
        {{ t('captcha.help') }}
      </p>
      <p :id="`${id}-error`" class="na:text-sm na:text-[var(--na-error)]" role="alert">
        {{ error || localError }}
      </p>
      <p ref="status" tabindex="-1" role="status" class="na:text-xs na:text-[var(--na-muted)]">
        {{ busy ? t('captcha.busy') : simulated ? t('captcha.demo') : t('captcha.provider') }}
      </p>
      <NovaButton v-if="error" variant="secondary" :disabled="busy" @click="emit('retry')">{{
        t('common.retry')
      }}</NovaButton>
    </div>
  </div>
</template>
