<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useNovaLocale } from '../locale'
import type { NovaMessageKey } from '../locales'
import NovaButton from './NovaButton.vue'

/** One issuance per mount. The host drops its copy on acknowledged. */
const props = defineProps<{ codes: readonly string[] }>()
const emit = defineEmits<{ acknowledged: [] }>()
const { t } = useNovaLocale()
const mounted = ref(false)
const acknowledged = ref(false)
const feedback = ref<NovaMessageKey>()
onMounted(() => {
  mounted.value = true
})

async function copy() {
  try {
    await navigator.clipboard.writeText(props.codes.join('\n'))
    feedback.value = 'mfa.copied'
  } catch {
    feedback.value = 'mfa.exportError'
  }
}
function download() {
  try {
    const url = URL.createObjectURL(
      new Blob([props.codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }),
    )
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = 'recovery-codes.txt'
      link.click()
      feedback.value = 'mfa.downloaded'
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  } catch {
    feedback.value = 'mfa.exportError'
  }
}
function acknowledge() {
  acknowledged.value = true
  emit('acknowledged')
}
</script>

<template>
  <section
    v-if="mounted && !acknowledged && codes.length"
    class="na:grid na:gap-3"
    :aria-label="t('mfa.recovery')"
  >
    <h3 class="na:text-base na:font-semibold">{{ t('mfa.recovery') }}</h3>
    <p>{{ t('mfa.saveHint') }}</p>
    <ul
      class="na:grid na:list-none na:gap-2 na:rounded-xl na:bg-[var(--na-soft)] na:p-4 na:font-mono na:sm:grid-cols-2"
    >
      <li v-for="(code, index) in codes" :key="index" class="na:wrap-anywhere">{{ code }}</li>
    </ul>
    <div class="na:flex na:flex-wrap na:gap-2">
      <NovaButton @click="copy">{{ t('mfa.copy') }}</NovaButton>
      <NovaButton @click="download">{{ t('mfa.download') }}</NovaButton>
      <NovaButton variant="primary" @click="acknowledge">{{ t('mfa.ack') }}</NovaButton>
    </div>
    <p v-if="feedback" role="status">{{ t(feedback) }}</p>
  </section>
  <p v-else-if="acknowledged" role="status">{{ t('mfa.saved') }}</p>
</template>
