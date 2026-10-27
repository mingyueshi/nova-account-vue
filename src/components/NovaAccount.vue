<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import NovaTheme from './NovaTheme.vue'
import NovaAuthForm from './NovaAuthForm.vue'
import NovaAccountCenter from './NovaAccountCenter.vue'
import NovaAppearance from './NovaAppearance.vue'
import type { AccountAdapter, AccountSnapshot, Appearance, AuthResult, Challenge, NovaAdapter, SessionUser } from '../types'
const props = withDefaults(defineProps<{ adapter: NovaAdapter; initialUser?: SessionUser | null; appearance?: Appearance; storageKey?: string | false; brand?: string }>(), { initialUser: null, storageKey: false, brand: 'nova' })
const emit = defineEmits<{ authenticated: [result: AuthResult]; logout: []; 'update:appearance': [appearance: Appearance] }>()
defineSlots<{
  brand?(): unknown
  footer?(): unknown
  tools?(props: { appearance: Appearance; setAppearance: (value: Appearance, persist?: boolean) => void; storageError: string; signedIn: boolean }): unknown
  captcha?(props: { challenge: Challenge; submit: (response: unknown) => Promise<void>; busy: boolean; error: string; cancel: () => void; retry: () => Promise<void> }): unknown
  security?(props: { snapshot: AccountSnapshot; adapter: AccountAdapter; refresh: () => Promise<AccountSnapshot | undefined> }): unknown
  securityFormTools?(props: { fill: (values: Partial<{ currentPassword: string; newPassword: string; confirmPassword: string; email: string; code: string }>) => void }): unknown
}>()
const user = shallowRef<SessionUser | null>(props.initialUser)
const auth = ref<InstanceType<typeof NovaAuthForm>>()
const center = ref<InstanceType<typeof NovaAccountCenter>>()
const logoutError = ref('')
const loggingOut = ref(false)
let controller: AbortController | null = null
let sequence = 0
watch(() => props.adapter, () => { controller?.abort(); sequence++; loggingOut.value = false; logoutError.value = ''; user.value = null })
onBeforeUnmount(() => { sequence++; controller?.abort() })
function authenticated(result: AuthResult) { user.value = result.user; emit('authenticated', result) }
async function logout() {
  if (loggingOut.value) return
  const ownSequence = ++sequence
  controller = new AbortController(); loggingOut.value = true; logoutError.value = ''
  try {
    await props.adapter.auth.logout({ signal: controller.signal, requestId: `logout-${sequence}` })
    if (ownSequence !== sequence || controller.signal.aborted) return
    user.value = null; emit('logout')
  } catch (error) { if (ownSequence === sequence) logoutError.value = error instanceof Error ? error.message : '退出失败，请重试。' }
  finally { if (ownSequence === sequence) loggingOut.value = false }
}
defineExpose({ fill: (value: { email?: string; password?: string; code?: string; confirmPassword?: string }) => auth.value?.fill(value), preview: (value: SessionUser) => { if (props.adapter.simulated) user.value = value }, fillSecurity: (value: { currentPassword?: string; newPassword?: string; confirmPassword?: string; email?: string; code?: string }) => center.value?.fillSecurity(value) })
</script>
<template>
  <NovaTheme :model-value="appearance" :storage-key="storageKey" @update:model-value="emit('update:appearance', $event)" v-slot="theme">
    <div class="na:flex na:h-dvh na:min-h-0 na:flex-col na:overflow-hidden">
      <header class="na:flex na:min-h-20 na:shrink-0 na:items-center na:justify-between na:gap-3 na:border-b na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-5 na:sm:px-9">
        <slot name="brand"><span class="na:text-xl na:font-semibold na:tracking-tight">{{ brand }}<span class="na:text-[var(--na-brand)]">.</span></span></slot>
        <slot name="tools" :appearance="theme.appearance" :set-appearance="theme.setAppearance" :storage-error="theme.storageError" :signed-in="!!user" />
      </header>
      <div v-if="logoutError" role="alert" class="na:bg-[var(--na-soft)] na:px-5 na:py-2 na:text-sm na:text-[var(--na-error)]">{{ logoutError }}</div>
      <div v-if="loggingOut" role="status" class="na:px-5 na:py-2 na:text-sm">正在退出…</div>
      <NovaAccountCenter v-if="user" ref="center" :adapter="adapter.account" :simulated="adapter.simulated" @logout="logout">
        <template #appearance><NovaAppearance :model-value="theme.appearance" :storage-error="theme.storageError" @update:model-value="theme.setAppearance" /></template>
        <template v-if="$slots.security" #security="slotProps"><slot name="security" v-bind="slotProps" /></template>
        <template #securityFormTools="slotProps"><slot name="securityFormTools" v-bind="slotProps" /></template>
      </NovaAccountCenter>
      <main v-else class="na:flex na:min-h-0 na:flex-1 na:overflow-y-auto na:px-5 na:py-10"><div class="na:m-auto na:w-full na:max-w-[352px]"><NovaAuthForm ref="auth" :adapter="adapter.auth" :simulated="adapter.simulated" @authenticated="authenticated"><template v-if="$slots.captcha" #captcha="slotProps"><slot name="captcha" v-bind="slotProps" /></template></NovaAuthForm></div></main>
      <footer class="na:shrink-0 na:border-t na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-4 na:py-3 na:text-center na:text-xs na:text-[var(--na-muted)]"><slot name="footer">{{ adapter.simulated ? '交互演示 · 请勿输入真实资料' : '账户服务' }}</slot></footer>
    </div>
  </NovaTheme>
</template>
