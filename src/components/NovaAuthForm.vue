<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { AuthAdapter, AuthMode, AuthResult, Challenge, PasswordStrength } from '../types'
import { useAuthFlow } from '../composables/useAuthFlow'
import NovaButton from './NovaButton.vue'
import NovaField from './NovaField.vue'
import NovaDialog from './NovaDialog.vue'
import NovaCaptcha from './NovaCaptcha.vue'

const { t } = useNovaLocale()
const props = withDefaults(
  defineProps<{
    adapter: AuthAdapter
    simulated?: boolean
    codeLength?: number | null
    passwordStrength?: (password: string) => PasswordStrength
  }>(),
  { simulated: false, codeLength: 6 },
)
const emit = defineEmits<{
  authenticated: [result: AuthResult]
  reset: []
  'mode-change': [mode: AuthMode]
}>()
defineSlots<{
  captcha?: (props: {
    challenge: Challenge
    submit: (response: unknown) => Promise<void>
    busy: boolean
    error: string
    cancel: () => void
    retry: () => Promise<void>
  }) => unknown
  footer?: () => unknown
  terms?: () => unknown
}>()
const flow = useAuthFlow(() => props.adapter, {
  onAuthenticated: (result) => emit('authenticated', result),
  onReset: () => emit('reset'),
})
const {
  mode,
  fields,
  busy,
  error,
  notice,
  fieldErrors,
  challenge,
  challengeOpen,
  challengeError,
  delivery,
  resetStage,
  resendSeconds,
  codeExpired,
} = flow
const id = useId()
const form = ref<HTMLFormElement>()
const title = ref<HTMLElement>()
const showPassword = ref(false)
const isLogin = computed(() => mode.value === 'password' || mode.value === 'code')
const heading = computed(() =>
  mode.value === 'register'
    ? t('auth.create')
    : mode.value === 'reset'
      ? resetStage.value === 'password'
        ? t('auth.setPassword')
        : t('auth.recover')
      : t('auth.welcome'),
)
const submitLabel = computed(() =>
  mode.value === 'register'
    ? t('auth.register')
    : mode.value === 'reset'
      ? resetStage.value === 'password'
        ? t('auth.reset')
        : t('auth.continue')
      : t('auth.login'),
)
const strength = computed(() =>
  mode.value !== 'password' && fields.password && props.passwordStrength
    ? props.passwordStrength(fields.password)
    : null,
)
const inputBlocked = computed(() => busy.value || challengeOpen.value)
watch(
  delivery,
  async (result) => {
    if (result) {
      await nextTick()
      form.value
        ?.querySelector<HTMLInputElement>('[autocomplete="one-time-code"]')
        ?.focus({ preventScroll: true })
    }
  },
  { flush: 'post' },
)
watch(
  resetStage,
  async (stage) => {
    if (stage === 'password') {
      await nextTick()
      form.value
        ?.querySelector<HTMLInputElement>('[autocomplete="new-password"]')
        ?.focus({ preventScroll: true })
    }
  },
  { flush: 'post' },
)
function setMode(value: AuthMode) {
  mode.value = value
  showPassword.value = false
  emit('mode-change', value)
}
async function switchView(value: AuthMode) {
  setMode(value)
  await nextTick()
  title.value?.focus({ preventScroll: true })
}
async function tabKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  setMode(event.key === 'ArrowLeft' || event.key === 'Home' ? 'password' : 'code')
  await nextTick()
  form.value?.parentElement
    ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
    ?.focus()
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
    <NovaButton v-if="!isLogin" variant="ghost" class="na:mb-6" @click="switchView('password')">{{
      t('auth.back')
    }}</NovaButton>
    <header class="na:mb-8">
      <h1
        :id="`${id}-title`"
        ref="title"
        tabindex="-1"
        class="na:text-3xl na:font-semibold na:tracking-tight"
      >
        {{ heading }}
      </h1>
      <p v-if="mode === 'reset'" class="na:mt-3 na:text-sm na:text-[var(--na-muted)]">
        {{ resetStage === 'password' ? t('auth.verified') : t('auth.verifyFirst') }}
      </p>
    </header>
    <div
      v-if="isLogin"
      role="tablist"
      :aria-label="t('auth.method')"
      class="na:mb-7 na:flex na:border-b na:border-[var(--na-line)]"
      @keydown="tabKey"
    >
      <button
        v-for="tab in ['password', 'code'] as const"
        :id="`${id}-${tab}-tab`"
        :key="tab"
        type="button"
        role="tab"
        :aria-selected="mode === tab"
        :aria-controls="`${id}-form`"
        :tabindex="mode === tab ? 0 : -1"
        class="na:relative na:flex-1 na:border-0 na:border-b-2 na:bg-transparent na:px-1 na:py-3 na:text-sm na:transition-colors"
        :class="
          mode === tab
            ? 'na:border-[var(--na-brand)] na:font-medium na:text-[var(--na-ink)]'
            : 'na:border-transparent na:text-[var(--na-muted)] na:hover:text-[var(--na-brand)]'
        "
        @click="setMode(tab)"
      >
        {{ tab === 'password' ? t('auth.passwordLogin') : t('auth.codeLogin') }}
      </button>
    </div>
    <form
      :id="`${id}-form`"
      ref="form"
      novalidate
      class="na:grid na:gap-5"
      :aria-labelledby="isLogin ? `${id}-${mode}-tab` : `${id}-title`"
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <NovaField
        v-if="mode !== 'reset' || resetStage === 'verify'"
        v-model="fields.email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        :placeholder="t('auth.emailPlaceholder')"
        :disabled="inputBlocked"
        :error="fieldErrors.email"
      />
      <template
        v-if="
          mode === 'password' ||
          mode === 'register' ||
          (mode === 'reset' && resetStage === 'password')
        "
      >
        <div class="na:relative na:grid na:gap-2">
          <NovaField
            v-model="fields.password"
            :label="mode === 'reset' ? t('auth.newPassword') : t('auth.password')"
            :type="showPassword ? 'text' : 'password'"
            :autocomplete="mode === 'password' ? 'current-password' : 'new-password'"
            :placeholder="t('auth.passwordPlaceholder')"
            :disabled="inputBlocked"
            :error="fieldErrors.password"
          />
          <div class="na:flex na:items-center na:justify-between na:gap-3 na:text-xs">
            <button
              type="button"
              class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-muted)] na:hover:text-[var(--na-brand)]"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? t('auth.hidePassword') : t('auth.showPassword') }}
            </button>
            <button
              v-if="mode === 'password'"
              type="button"
              class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-brand)]"
              @click="switchView('reset')"
            >
              {{ t('auth.forgot') }}
            </button>
          </div>
        </div>
        <div v-if="strength" class="na:grid na:gap-1 na:text-xs na:text-[var(--na-muted)]">
          <label :for="`${id}-strength`">{{ t('auth.strength') }}: {{ strength.label }}</label>
          <meter :id="`${id}-strength`" min="0" max="4" :value="strength.score" class="na:w-full" />
          <p v-if="strength.hint">{{ strength.hint }}</p>
        </div>
        <NovaField
          v-if="mode === 'reset'"
          v-model="fields.confirmPassword"
          :label="t('auth.confirmPassword')"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :placeholder="t('auth.confirmPlaceholder')"
          :disabled="inputBlocked"
          :error="fieldErrors.confirmPassword"
        />
      </template>
      <div
        v-if="
          mode === 'code' || mode === 'register' || (mode === 'reset' && resetStage === 'verify')
        "
        class="na:grid na:gap-2"
      >
        <NovaField
          v-model="fields.code"
          :label="t('auth.code')"
          autocomplete="one-time-code"
          inputmode="numeric"
          :maxlength="codeLength ?? undefined"
          :placeholder="t('auth.codePlaceholder')"
          :disabled="inputBlocked"
          :error="fieldErrors.code"
        />
        <div class="na:flex na:items-center na:justify-between na:gap-3">
          <span class="na:text-xs na:text-[var(--na-muted)]" role="status">{{
            codeExpired ? t('auth.codeExpired') : delivery ? t('auth.codeSent') : ''
          }}</span>
          <NovaButton
            variant="ghost"
            :disabled="inputBlocked || resendSeconds > 0"
            @click="requestCode"
            >{{
              resendSeconds > 0
                ? t('auth.retryAfter', { seconds: resendSeconds })
                : delivery
                  ? t('auth.resend')
                  : t('auth.requestCode')
            }}</NovaButton
          >
        </div>
        <p
          v-if="simulated && delivery?.demoCode"
          class="na:text-xs na:text-[var(--na-muted)]"
          role="status"
        >
          {{ t('auth.demoCode', { code: delivery.demoCode }) }}
        </p>
      </div>
      <div v-if="mode === 'register'" class="na:grid na:gap-2">
        <label
          class="na:flex na:items-start na:gap-3 na:text-xs na:leading-relaxed na:text-[var(--na-muted)]"
        >
          <input
            v-model="fields.consent"
            type="checkbox"
            :disabled="inputBlocked"
            :aria-invalid="!!fieldErrors.consent"
            :aria-describedby="`${id}-consent-error`"
            class="na:mt-0.5 na:h-4 na:w-4 na:shrink-0 na:accent-[var(--na-brand)]"
          />
          <span
            ><slot name="terms">{{ t('auth.terms') }}</slot></span
          >
        </label>
        <p :id="`${id}-consent-error`" class="na:text-xs na:text-[var(--na-error)]" role="alert">
          {{ fieldErrors.consent }}
        </p>
      </div>
      <p
        v-if="error"
        role="alert"
        class="na:rounded-lg na:border na:border-[var(--na-error)] na:p-3 na:text-sm na:text-[var(--na-error)]"
      >
        {{ error }}
      </p>
      <p
        v-if="notice && (!simulated || !delivery)"
        role="status"
        class="na:text-sm na:text-[var(--na-muted)]"
      >
        {{ notice }}
      </p>
      <NovaButton
        type="submit"
        variant="primary"
        :disabled="inputBlocked"
        class="na:mt-1 na:w-full"
        >{{ busy ? t('common.processing') : submitLabel }}</NovaButton
      >
    </form>
    <p v-if="isLogin" class="na:mt-7 na:text-center na:text-sm na:text-[var(--na-muted)]">
      {{ t('auth.noAccount')
      }}<button
        type="button"
        class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-brand)]"
        @click="switchView('register')"
      >
        {{ t('auth.register') }}
      </button>
    </p>
    <p
      v-else-if="mode === 'register'"
      class="na:mt-7 na:text-center na:text-sm na:text-[var(--na-muted)]"
    >
      {{ t('auth.haveAccount')
      }}<button
        type="button"
        class="na:border-0 na:bg-transparent na:p-0 na:text-[var(--na-brand)]"
        @click="switchView('password')"
      >
        {{ t('auth.login') }}
      </button>
    </p>
    <div class="na:mt-7 na:text-center na:text-xs na:text-[var(--na-muted)]">
      <slot name="footer"
        ><span v-if="simulated">{{ t('demo.disclosure') }}</span></slot
      >
    </div>
    <NovaDialog :open="challengeOpen" :title="t('captcha.title')" @close="flow.cancel">
      <template v-if="challenge">
        <slot
          name="captcha"
          :challenge="challenge"
          :submit="flow.verifyChallenge"
          :busy="busy"
          :error="challengeError"
          :cancel="flow.cancel"
          :retry="flow.retryChallenge"
        >
          <NovaCaptcha
            v-if="challenge.kind === 'slider'"
            :challenge="challenge"
            :busy="busy"
            :error="challengeError"
            :simulated="simulated"
            @submit="flow.verifyChallenge"
            @retry="flow.retryChallenge"
          />
          <p v-else role="alert" class="na:text-sm na:text-[var(--na-error)]">
            {{ t('captcha.custom') }}
          </p>
        </slot>
      </template>
      <div v-else class="na:grid na:gap-4">
        <p role="status" class="na:text-sm na:text-[var(--na-muted)]">
          {{ busy ? t('captcha.loading') : t('captcha.unavailable') }}
        </p>
        <p v-if="challengeError" role="alert" class="na:text-sm na:text-[var(--na-error)]">
          {{ challengeError }}
        </p>
        <NovaButton
          v-if="challengeError"
          variant="secondary"
          :disabled="busy"
          @click="flow.retryChallenge"
          >{{ t('common.retry') }}</NovaButton
        >
      </div>
    </NovaDialog>
  </section>
</template>
