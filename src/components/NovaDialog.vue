<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import NovaButton from './NovaButton.vue'
const { t } = useNovaLocale()
const props = defineProps<{ open: boolean; title: string; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ close: [] }>()
defineSlots<{ default(): unknown; footer?(): unknown }>()
const dialog = ref<HTMLDialogElement>()
const heading = ref<HTMLElement>()
const id = useId()
let previousFocus: HTMLElement | null = null
let mounted = false
const nativeModal = ref(false)
function sync() {
  const el = dialog.value
  if (!mounted || !el) return
  if (props.open && !el.open) {
    previousFocus = props.returnFocus ?? (el.ownerDocument.activeElement as HTMLElement | null)
    nativeModal.value = typeof el.showModal === 'function'
    if (nativeModal.value) el.showModal()
    else el.setAttribute('open', '')
    nextTick(() => heading.value?.focus({ preventScroll: true }))
  } else if (!props.open && el.open) {
    el.close?.()
    el.removeAttribute('open')
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }
}
function onNativeClose() {
  // Native close events are queued: an older event must not close a reopened dialog.
  if (props.open && dialog.value && !dialog.value.open) emit('close')
}
watch(() => props.open, sync, { flush: 'post' })
onMounted(() => {
  mounted = true
  sync()
})
onBeforeUnmount(() => {
  dialog.value?.close?.()
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
</script>
<template>
  <dialog
    ref="dialog"
    :aria-labelledby="id"
    :aria-modal="nativeModal ? 'true' : undefined"
    class="nova-dialog na:m-auto na:w-[calc(100%-2rem)] na:max-w-md na:rounded-2xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:p-6 na:text-[var(--na-ink)]"
    @cancel.prevent="emit('close')"
    @close="onNativeClose"
  >
    <header class="nova-dialog-header na:mb-5 na:flex na:items-start na:justify-between na:gap-4">
      <h2 :id="id" ref="heading" tabindex="-1" class="na:m-0 na:pt-2 na:text-lg na:font-semibold">
        {{ title }}
      </h2>
      <NovaButton
        class="na:shrink-0"
        variant="ghost"
        :aria-label="t('dialog.close')"
        @click="emit('close')"
        >×</NovaButton
      >
    </header>
    <div class="nova-dialog-body"><slot /></div>
    <footer v-if="$slots.footer" class="nova-dialog-footer na:mt-6"><slot name="footer" /></footer>
  </dialog>
</template>
