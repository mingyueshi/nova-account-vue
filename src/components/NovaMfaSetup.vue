<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useAccount } from '../composables/useAccount'
import { useNovaLocale } from '../locale'
import type { NovaMessageKey } from '../locales'
import type { AccountAdapter, AccountSnapshot, TotpEnrollment } from '../types'
import NovaButton from './NovaButton.vue'
import NovaField from './NovaField.vue'
import NovaRecoveryCodes from './NovaRecoveryCodes.vue'

const props = defineProps<{ adapter: AccountAdapter; snapshot: AccountSnapshot }>()
const emit = defineEmits<{ enrolled: [] }>()
const { t } = useNovaLocale()
const { requestResult, busy, error, cancel } = useAccount(() => props.adapter)
const enrollment = shallowRef<TotpEnrollment>()
const recoveryCodes = shallowRef<string[]>([])
const confirmed = ref(false)
const code = ref('')
const invalidCode = ref(false)
const issue = ref<NovaMessageKey>()
const inputForm = ref<HTMLFormElement>()
const digits = computed(() => enrollment.value?.digits ?? 6)
let confirming: TotpEnrollment | undefined
let expiryTimer: ReturnType<typeof setTimeout> | undefined

function clearEnrollment() {
  clearTimeout(expiryTimer)
  enrollment.value = undefined
  code.value = ''
  invalidCode.value = false
}
function reset() {
  cancel()
  confirming = undefined
  clearEnrollment()
  recoveryCodes.value = []
  confirmed.value = false
  issue.value = undefined
}
watch([() => props.adapter, () => props.adapter.mfa, () => props.snapshot.profile.id], reset, {
  flush: 'sync',
})
watch(
  () => props.snapshot.security.twoStepEnabled,
  (enabled) => {
    // A refresh can observe the server commit before its one-time codes reach this request.
    if (!enabled || (!confirming && !confirmed.value)) reset()
  },
  { flush: 'sync' },
)
onScopeDispose(reset)

function checkExpiry() {
  if (!enrollment.value) return
  const remaining = enrollment.value.expiresAt - Date.now()
  if (remaining > 0) {
    expiryTimer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647))
  } else if (!confirming) {
    clearEnrollment()
    issue.value = 'mfa.expired'
  }
}
async function begin() {
  const mfa = props.adapter.mfa
  if (!mfa || busy.value) return
  issue.value = undefined
  const revision = props.snapshot.revision
  const result = await requestResult(async (context) => ({
    enrollment: await mfa.beginTotp({ ...context, revision }),
    signal: context.signal,
  }))
  if (result.status !== 'success' || result.value.signal.aborted) return
  const data = result.value.enrollment
  if (
    !data ||
    typeof data.id !== 'string' ||
    !data.id.trim() ||
    typeof data.manualKey !== 'string' ||
    !data.manualKey.trim() ||
    !Number.isFinite(data.expiresAt) ||
    (data.digits !== undefined && ![6, 8].includes(data.digits)) ||
    (data.qrCodeDataUrl !== undefined &&
      (typeof data.qrCodeDataUrl !== 'string' ||
        !/^data:image\/png;base64,[a-z\d+/]+=*$/i.test(data.qrCodeDataUrl)))
  ) {
    issue.value = 'mfa.invalidResponse'
    return
  }
  enrollment.value = data
  checkExpiry()
  await nextTick()
  inputForm.value?.querySelector('input')?.focus()
}
async function confirm() {
  const mfa = props.adapter.mfa
  const current = enrollment.value
  if (!mfa || !current || busy.value) return
  if (current.expiresAt <= Date.now()) {
    checkExpiry()
    return
  }
  const value = code.value.trim()
  if (!/^\d+$/.test(value) || value.length !== digits.value) {
    invalidCode.value = true
    inputForm.value?.querySelector('input')?.focus()
    return
  }
  const revision = props.snapshot.revision
  confirming = current
  const result = await requestResult((context) =>
    mfa.confirmTotp({ enrollmentId: current.id, code: value }, { ...context, revision }),
  )
  if (confirming !== current) return
  confirming = undefined
  if (result.status !== 'success') {
    if (props.snapshot.security.twoStepEnabled) clearEnrollment()
    else if (current.expiresAt <= Date.now()) checkExpiry()
    return
  }
  clearEnrollment()
  const codes = result.value?.recoveryCodes
  if (!Array.isArray(codes) || !codes.every((item) => typeof item === 'string' && item.trim())) {
    issue.value = 'mfa.invalidResponse'
    return
  }
  confirmed.value = true
  issue.value = undefined
  recoveryCodes.value = [...codes]
  emit('enrolled')
}
</script>
<template>
  <section v-if="adapter.mfa" class="na:grid na:gap-4" :aria-label="t('mfa.title')">
    <h3 class="na:text-base na:font-semibold">{{ t('mfa.title') }}</h3>
    <p v-if="confirmed || snapshot.security.twoStepEnabled" role="status">{{ t('mfa.enabled') }}</p>
    <form v-else-if="enrollment" ref="inputForm" class="na:grid na:gap-3" @submit.prevent="confirm">
      <p>{{ t(enrollment.qrCodeDataUrl ? 'mfa.scan' : 'mfa.manual') }}</p>
      <img
        v-if="enrollment.qrCodeDataUrl"
        :src="enrollment.qrCodeDataUrl"
        :alt="t('mfa.qr')"
        width="192"
        height="192"
      />
      <code class="na:wrap-anywhere na:rounded-xl na:bg-[var(--na-soft)] na:p-3">{{
        enrollment.manualKey
      }}</code>
      <NovaField
        v-model="code"
        :label="t('mfa.code')"
        inputmode="numeric"
        autocomplete="one-time-code"
        :maxlength="digits"
        :disabled="busy"
        :error="invalidCode ? t('mfa.invalidCode', { digits }) : ''"
        @update:model-value="invalidCode = false"
      />
      <div class="na:flex na:flex-wrap na:gap-2">
        <NovaButton type="submit" variant="primary" :busy="busy">{{ t('mfa.confirm') }}</NovaButton>
        <NovaButton :disabled="busy" @click="reset">{{ t('common.cancel') }}</NovaButton>
      </div>
    </form>
    <div v-else class="na:flex na:flex-wrap na:gap-2">
      <NovaButton variant="primary" :busy="busy" @click="begin">{{ t('mfa.start') }}</NovaButton>
      <NovaButton v-if="busy" @click="reset">{{ t('common.cancel') }}</NovaButton>
    </div>
    <p v-if="issue || error" role="alert" class="na:text-sm na:text-[var(--na-error)]">
      {{ issue ? t(issue) : error }}
    </p>
    <NovaRecoveryCodes
      v-if="recoveryCodes.length"
      :codes="recoveryCodes"
      @acknowledged="recoveryCodes = []"
    />
  </section>
</template>
