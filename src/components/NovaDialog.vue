<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import NovaButton from './NovaButton.vue'
const { t } = useNovaLocale()
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
defineSlots<{ default(): unknown; footer?(): unknown }>()
const dialog = ref<HTMLDialogElement>()
const heading = ref<HTMLElement>()
const id = useId()
let previousFocus: HTMLElement | null = null
let mounted = false
function sync() {
  const el = dialog.value
  if (!mounted || !el) return
  if (props.open && !el.open) {
    previousFocus = el.ownerDocument.activeElement as HTMLElement | null
    if (typeof el.showModal === 'function') el.showModal()
    else el.setAttribute('open', '')
    nextTick(() => heading.value?.focus())
  } else if (!props.open && el.open) {
    if (typeof el.close === 'function') el.close()
    else el.removeAttribute('open')
    if (previousFocus?.isConnected) previousFocus.focus()
  }
}
watch(() => props.open, sync, { flush: 'post' })
onMounted(() => {
  mounted = true
  sync()
})
onBeforeUnmount(() => {
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>
<template>
  <dialog
    ref="dialog"
    :aria-labelledby="id"
    aria-modal="true"
    class="nova-dialog na:m-auto na:max-h-[calc(100dvh-2rem)] na:w-[calc(100%-2rem)] na:max-w-md na:overflow-y-auto na:rounded-2xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:p-6 na:text-[var(--na-ink)] na:shadow-2xl"
    @cancel.prevent="emit('close')"
    @close="props.open && emit('close')"
  >
    <header class="na:mb-5 na:flex na:items-start na:justify-between na:gap-4">
      <h2 :id="id" ref="heading" tabindex="-1" class="na:pt-2 na:text-lg na:font-semibold">
        {{ title }}
      </h2>
      <NovaButton variant="ghost" :aria-label="t('dialog.close')" @click="emit('close')"
        >×</NovaButton
      >
    </header>
    <slot />
    <footer v-if="$slots.footer" class="na:mt-6"><slot name="footer" /></footer>
  </dialog>
</template>
