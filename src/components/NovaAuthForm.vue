<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { AuthAdapter, AuthMode, AuthResult, Challenge } from '../types'
import { useAuthFlow } from '../composables/useAuthFlow'
import NovaButton from './NovaButton.vue'
import NovaField from './NovaField.vue'
import NovaDialog from './NovaDialog.vue'
import NovaCaptcha from './NovaCaptcha.vue'

const props = withDefaults(defineProps<{ adapter: AuthAdapter; simulated?: boolean }>(), { simulated: false })
const emit = defineEmits<{ authenticated: [result: AuthResult]; reset: []; 'mode-change': [mode: AuthMode] }>()
defineSlots<{
  captcha?: (props: { challenge: Challenge; submit: (response: unknown) => Promise<void>; busy: boolean; error: string; cancel: () => void; retry: () => Promise<void> }) => unknown
  footer?: () => unknown
  terms?: () => unknown
}>()
const flow = useAuthFlow(() => props.adapter, { onAuthenticated: result => emit('authenticated', result), onReset: () => emit('reset') })
const { mode, fields, busy, error, notice, fieldErrors, challenge, challengeOpen, challengeError, delivery, resetStage, resendSeconds, codeExpired } = flow
const id = useId()
const form = ref<HTMLFormElement>()
const title = ref<HTMLElement>()
const showPassword = ref(false)
const isLogin = computed(() => mode.value === 'password' || mode.value === 'code')
const heading = computed(() => mode.value === 'register' ? '创建账户' : mode.value === 'reset' ? resetStage.value === 'password' ? '设置新密码' : '找回密码' : '欢迎回来')
const submitLabel = computed(() => mode.value === 'register' ? '注册' : mode.value === 'reset' ? resetStage.value === 'password' ? '确认重置' : '继续' : '登录')
const inputBlocked = computed(() => busy.value || challengeOpen.value)
watch(delivery, async result => {
  if (result) { await nextTick(); form.value?.querySelector<HTMLInputElement>('[autocomplete="one-time-code"]')?.focus({ preventScroll: true }) }
}, { flush: 'post' })
watch(resetStage, async stage => {
  if (stage === 'password') { await nextTick(); form.value?.querySelector<HTMLInputElement>('[autocomplete="new-password"]')?.focus({ preventScroll: true }) }
}, { flush: 'post' })
function setMode(value: AuthMode) {
  mode.value = value
  showPassword.value = false
  emit('mode-change', value)
}
async function switchView(value: AuthMode) { setMode(value); await nextTick(); title.value?.focus({ preventScroll: true }) }
async function tabKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  setMode(event.key === 'ArrowLeft' || event.key === 'Home' ? 'password' : 'code')
  await nextTick()
  form.value?.parentElement?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()
}
async function submit() {
  await flow.submit()
  await nextTick()
  form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
async function requestCode() {
  await flow.requestCode()
  await nextTick()
  form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
defineExpose({ fill: flow.fill, cancel: flow.cancel, setMode })
</script>

<template>
  <section class="na:mx-auto na:w-full na:max-w-[352px] na:py-8" :aria-labelledby="`${id}-title`">
    <NovaButton v-if="!isLogin" variant="ghost" class="na:mb-6" @click="switchView('password')">← 返回登录</NovaButton>
    <header class="na:mb-8">
      <h1 :id="`${id}-title`" ref="title" tabindex="-1" class="na:text-3xl na:font-semibold na:tracking-tight">{{ heading }}</h1>
      <p v-if="mode === 'reset'" class="na:mt-3 na:text-sm na:text-[var(--na-muted)]">{{ resetStage === 'password' ? '邮箱已验证，请设置新密码。' : '验证邮箱后，即可设置新密码。' }}</p>
    </header>
    <div v-if="isLogin" role="tablist" aria-label="登录方式" class="na:mb-7 na:flex na:border-b na:border-[var(--na-line)]" @keydown="tabKey">
      <button v-for="tab in (['password', 'code'] as const)" :id="`${id}-${tab}-tab`" :key="tab" type="button" role="tab"
        :aria-selected="mode === tab" :aria-controls="`${id}-form`" :tabindex="mode === tab ? 0 : -1"
        class="na:relative na:flex-1 na:border-0 na:border-b-2 na:bg-transparent na:px-1 na:py-3 na:text-sm na:transition-colors"
        :class="mode === tab ? 'na:border-[var(--na-brand)] na:font-medium na:text-[var(--na-ink)]' : 'na:border-transparent na:text-[var(--na-muted)] na:hover:text-[var(--na-brand)]'"
        @click="setMode(tab)">{{ tab === 'password' ? '密码登录' : '验证码登录' }}</button>
    </div>
    <form :id="`${id}-form`" ref="form" novalidate class="na:grid na:gap-5" :aria-labelledby="isLogin ? `${id}-${mode}-tab` : `${id}-title`" :aria-busy="busy" @submit.prevent="submit">
      <NovaField v-if="mode !== 'reset' || resetStage === 'verify'" v-model="fields.email" label="邮箱" type="email" autocomplete="email" placeholder="输入邮箱地址" :disabled="inputBlocked" :error="fieldErrors.email" />
      <template v-if="mode === 'password' || mode === 'register' || (mode === 'reset' && resetStage === 'password')">
        <div class="na:relative na:grid na:gap-2">
          <NovaField v-model="fields.password" :label="mode === 'reset' ? '新密码' : '密码'" :type="showPassword ? 'text' : 'password'" :autocomplete="mode === 'password' ? 'current-password' : 'new-password'" placeholder="输入密码" :disabled="inputBlocked" :error="fieldErrors.password" />
          <div class="na:flex na:items-center na:justify-between na:gap-3 na:text-xs">
            <button type="button" class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-muted)] na:hover:text-[var(--na-brand)]" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ showPassword ? '隐藏密码' : '显示密码' }}</button>
            <button v-if="mode === 'password'" type="button" class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-brand)]" @click="switchView('reset')">忘记密码？</button>
          </div>
        </div>
        <NovaField v-if="mode === 'reset'" v-model="fields.confirmPassword" label="确认新密码" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入新密码" :disabled="inputBlocked" :error="fieldErrors.confirmPassword" />
      </template>
      <div v-if="mode === 'code' || mode === 'register' || (mode === 'reset' && resetStage === 'verify')" class="na:grid na:gap-2">
        <NovaField v-model="fields.code" label="验证码" autocomplete="one-time-code" inputmode="numeric" placeholder="输入邮箱验证码" :disabled="inputBlocked" :error="fieldErrors.code" />
        <div class="na:flex na:items-center na:justify-between na:gap-3">
          <span class="na:text-xs na:text-[var(--na-muted)]" role="status">{{ codeExpired ? '验证码已过期' : delivery ? '验证码已发出' : '' }}</span>
          <NovaButton variant="ghost" :disabled="inputBlocked || resendSeconds > 0" @click="requestCode">{{ resendSeconds > 0 ? `${resendSeconds} 秒后重试` : delivery ? '重新获取' : '获取验证码' }}</NovaButton>
        </div>
        <p v-if="simulated && delivery?.demoCode" class="na:text-xs na:text-[var(--na-muted)]" role="status">演示码 {{ delivery.demoCode }} · 没有发送真实邮件</p>
      </div>
      <div v-if="mode === 'register'" class="na:grid na:gap-2">
        <label class="na:flex na:items-start na:gap-3 na:text-xs na:leading-relaxed na:text-[var(--na-muted)]">
          <input v-model="fields.consent" type="checkbox" :disabled="inputBlocked" :aria-invalid="!!fieldErrors.consent" :aria-describedby="`${id}-consent-error`" class="na:mt-0.5 na:h-4 na:w-4 na:shrink-0 na:accent-[var(--na-brand)]" />
          <span><slot name="terms">我已阅读并同意服务条款与隐私说明</slot></span>
        </label>
        <p :id="`${id}-consent-error`" class="na:text-xs na:text-[var(--na-error)]" role="alert">{{ fieldErrors.consent }}</p>
      </div>
      <p v-if="error" role="alert" class="na:rounded-lg na:border na:border-[var(--na-error)] na:p-3 na:text-sm na:text-[var(--na-error)]">{{ error }}</p>
      <p v-if="notice && (!simulated || !delivery)" role="status" class="na:text-sm na:text-[var(--na-muted)]">{{ notice }}</p>
      <NovaButton type="submit" variant="primary" :disabled="inputBlocked" class="na:mt-1 na:w-full">{{ busy ? '正在处理…' : submitLabel }}</NovaButton>
    </form>
    <p v-if="isLogin" class="na:mt-7 na:text-center na:text-sm na:text-[var(--na-muted)]">还没有账户？ <button type="button" class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-brand)]" @click="switchView('register')">注册</button></p>
    <p v-else-if="mode === 'register'" class="na:mt-7 na:text-center na:text-sm na:text-[var(--na-muted)]">已有账户？ <button type="button" class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-brand)]" @click="switchView('password')">登录</button></p>
    <div class="na:mt-7 na:text-center na:text-xs na:text-[var(--na-muted)]"><slot name="footer"><span v-if="simulated">交互演示 · 请勿输入真实资料</span></slot></div>
    <NovaDialog :open="challengeOpen" title="安全验证" @close="flow.cancel">
      <template v-if="challenge">
        <slot name="captcha" :challenge="challenge" :submit="flow.verifyChallenge" :busy="busy" :error="challengeError" :cancel="flow.cancel" :retry="flow.retryChallenge">
          <NovaCaptcha v-if="challenge.kind === 'slider'" :challenge="challenge" :busy="busy" :error="challengeError" :simulated="simulated" @submit="flow.verifyChallenge" @retry="flow.retryChallenge" />
          <p v-else role="alert" class="na:text-sm na:text-[var(--na-error)]">当前验证方式需要接入专用验证组件。请通过 captcha 插槽配置，或联系服务提供方。</p>
        </slot>
      </template>
      <div v-else class="na:grid na:gap-4">
        <p role="status" class="na:text-sm na:text-[var(--na-muted)]">{{ busy ? '正在载入验证…' : '验证暂不可用。' }}</p>
        <p v-if="challengeError" role="alert" class="na:text-sm na:text-[var(--na-error)]">{{ challengeError }}</p>
        <NovaButton v-if="challengeError" variant="secondary" :disabled="busy" @click="flow.retryChallenge">重新载入验证</NovaButton>
      </div>
    </NovaDialog>
  </section>
</template>
