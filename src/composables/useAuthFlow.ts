import { useNovaLocale } from '../locale'
import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { NovaError, NOVA_ERROR_CODES } from '../types'
import type {
  AuthAdapter,
  AuthMode,
  AuthResult,
  CaptchaPurpose,
  Challenge,
  CodeDelivery,
  CodePurpose,
  RequestContext,
  ResetVerification,
} from '../types'

export interface AuthFlowOptions {
  onAuthenticated?: (result: AuthResult) => void
  onReset?: () => void
  now?: () => number
}

/** Per-component presentation flow. An aborted HTTP request is not proof of server rollback. */
export function useAuthFlow(
  adapter: AuthAdapter | (() => AuthAdapter),
  options: AuthFlowOptions = {},
) {
  const { t } = useNovaLocale()
  const getAdapter = () => (typeof adapter === 'function' ? adapter() : adapter)
  const now = options.now ?? Date.now
  const mode = ref<AuthMode>('password')
  const fields = reactive({
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
    consent: false,
  })
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const fieldMessages = reactive<Record<keyof typeof fields, string | (() => string)>>({
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
    consent: '',
  })
  // Keep public string properties writable, while built-in messages follow locale overrides.
  function fieldError(field: keyof typeof fields) {
    return computed({
      get() {
        const message = fieldMessages[field]
        return typeof message === 'function' ? message() : message
      },
      set(value: string) {
        fieldMessages[field] = value
      },
    })
  }
  const fieldErrors = reactive({
    email: fieldError('email'),
    password: fieldError('password'),
    confirmPassword: fieldError('confirmPassword'),
    code: fieldError('code'),
    consent: fieldError('consent'),
  })
  const challenge = shallowRef<Challenge | null>(null)
  const challengeOpen = ref(false)
  const challengeError = ref('')
  const delivery = shallowRef<CodeDelivery | null>(null)
  const resetVerification = shallowRef<ResetVerification | null>(null)
  const resetStage = computed(() => (resetVerification.value ? 'password' : 'verify'))
  const clock = ref(now())
  const resendAt = ref(0)
  const resendSeconds = computed(() =>
    Math.max(0, Math.ceil((resendAt.value - clock.value) / 1000)),
  )
  const codeExpired = computed(() => !!delivery.value && delivery.value.expiresAt <= clock.value)
  const normalizedEmail = computed(() => fields.email.trim().toLowerCase())
  const purpose = computed<CaptchaPurpose>(
    () =>
      (
        ({
          password: 'login-password',
          code: 'login-code',
          register: 'register',
          reset: 'reset-password',
        }) as const
      )[mode.value],
  )
  let generation = 0
  let controller: AbortController | null = null
  let sequence = 0
  // Correlation only, never a security credential or a durable idempotency key.
  const requestPrefix = `nova-${now().toString(36)}-${Math.random().toString(36).slice(2)}`
  let action: 'login' | 'send-code' | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false

  function tick() {
    clock.value = now()
  }
  function visibilityChanged() {
    clearInterval(timer)
    timer = undefined
    tick()
    if (!document.hidden) timer = setInterval(tick, 1000)
  }
  onMounted(() => {
    visibilityChanged()
    document.addEventListener('visibilitychange', visibilityChanged)
  })
  onScopeDispose(() => {
    disposed = true
    clearInterval(timer)
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', visibilityChanged)
    invalidate()
    fields.email = ''
    clearCredentials()
  })

  function abortPending() {
    generation += 1
    controller?.abort()
    controller = null
    busy.value = false
  }
  function begin() {
    abortPending()
    controller = new AbortController()
    busy.value = true
    const id = generation
    const signal = controller.signal
    return {
      current: () => !disposed && id === generation && !signal.aborted,
      context: (): RequestContext => ({ signal, requestId: `${requestPrefix}-${++sequence}` }),
    }
  }
  function clearErrors() {
    error.value = ''
    Object.keys(fieldErrors).forEach((key) => {
      fieldErrors[key as keyof typeof fieldErrors] = ''
    })
  }
  function clearCredentials() {
    fields.password = ''
    fields.confirmPassword = ''
    fields.code = ''
    fields.consent = false
  }
  function cancel() {
    abortPending()
    challengeOpen.value = false
    challenge.value = null
    challengeError.value = ''
    action = null
  }
  function invalidate() {
    cancel()
    delivery.value = null
    resetVerification.value = null
    resendAt.value = 0
    fields.code = ''
    notice.value = ''
    clearErrors()
  }
  watch(() => fields.email, invalidate, { flush: 'sync' })
  watch(
    mode,
    () => {
      invalidate()
      clearCredentials()
    },
    { flush: 'sync' },
  )
  watch(
    getAdapter,
    () => {
      invalidate()
      clearCredentials()
    },
    { flush: 'sync' },
  )

  function validateEmail() {
    const valid =
      normalizedEmail.value.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.value)
    fieldMessages.email = valid ? '' : () => t('flow.emailInvalid')
    return valid
  }
  function validatePassword() {
    fieldMessages.password =
      fields.password.length > 0 && fields.password.length <= 1024
        ? ''
        : () => t('flow.passwordInvalid')
    return !fieldErrors.password
  }
  function validateCode() {
    fieldMessages.code = fields.code.trim() ? '' : () => t('flow.codeRequired')
    if (!delivery.value) fieldMessages.code = () => t('flow.deliveryRequired')
    else if (delivery.value.expiresAt <= now()) fieldMessages.code = () => t('flow.codeExpired')
    return !fieldErrors.code
  }
  function message(cause: unknown) {
    return cause instanceof Error ? cause.message : t('common.error')
  }
  function ensureFresh(token: { expiresAt: number }, label: string) {
    if (!Number.isFinite(token.expiresAt) || token.expiresAt <= now())
      throw new NovaError(NOVA_ERROR_CODES.VERIFICATION_EXPIRED, t('flow.expired', { label }))
  }

  async function loadChallenge(nextAction: 'login' | 'send-code') {
    if (busy.value || disposed) return
    clearErrors()
    if (!validateEmail() || (nextAction === 'login' && !validatePassword())) return
    tick()
    if (nextAction === 'send-code' && (mode.value === 'password' || resendSeconds.value > 0)) return
    action = nextAction
    challengeOpen.value = true
    challenge.value = null
    challengeError.value = ''
    const operation = begin()
    try {
      const result = await getAdapter().challenge(
        { email: normalizedEmail.value, purpose: purpose.value },
        operation.context(),
      )
      if (!operation.current()) return
      ensureFresh(result, t('flow.challenge'))
      if (!result.id || !['slider', 'custom'].includes(result.kind))
        throw new NovaError(NOVA_ERROR_CODES.CHALLENGE_INVALID, t('flow.challengeInvalid'))
      challenge.value = result
    } catch (cause) {
      if (operation.current()) challengeError.value = message(cause)
    } finally {
      if (operation.current()) busy.value = false
    }
  }
  async function requestCode() {
    if (!challengeOpen.value) await loadChallenge('send-code')
  }
  async function retryChallenge() {
    if (busy.value || !action) return
    await loadChallenge(action)
  }

  function complete(result: AuthResult) {
    cancel()
    delivery.value = null
    resetVerification.value = null
    clearCredentials()
    options.onAuthenticated?.(result)
  }

  async function verifyChallenge(response: unknown) {
    if (busy.value || !challengeOpen.value || !challenge.value || !action || disposed) return
    const currentChallenge = challenge.value
    const currentAction = action
    const email = normalizedEmail.value
    const boundPurpose = purpose.value
    challengeError.value = ''
    const operation = begin()
    try {
      ensureFresh(currentChallenge, t('flow.challenge'))
      const proof = await getAdapter().verifyCaptcha(
        { challengeId: currentChallenge.id, email, purpose: boundPurpose, response },
        operation.context(),
      )
      if (!operation.current()) return
      ensureFresh(proof, t('flow.proof'))
      if (!proof.token) throw new NovaError(NOVA_ERROR_CODES.PROOF_INVALID, t('flow.proofInvalid'))
      if (currentAction === 'send-code') {
        if (boundPurpose === 'login-password')
          throw new NovaError(NOVA_ERROR_CODES.PURPOSE_INVALID, t('flow.purposeInvalid'))
        const result = await getAdapter().sendCode(
          { email, purpose: boundPurpose as CodePurpose, proof: proof.token },
          operation.context(),
        )
        if (!operation.current()) return
        ensureFresh(result, t('auth.code'))
        if (!Number.isFinite(result.retryAfter) || result.retryAfter < 0)
          throw new NovaError(NOVA_ERROR_CODES.DELIVERY_INVALID, t('flow.deliveryInvalid'))
        delivery.value = result
        resendAt.value = now() + result.retryAfter * 1000
        tick()
        cancel()
        notice.value = t('flow.codeSent')
      } else {
        const result = await getAdapter().login(
          { email, method: 'password', password: fields.password, proof: proof.token },
          operation.context(),
        )
        if (operation.current()) complete(result)
      }
    } catch (cause) {
      if (operation.current()) challengeError.value = message(cause)
    } finally {
      if (operation.current()) busy.value = false
    }
  }

  async function submit() {
    if (busy.value || challengeOpen.value || disposed) return
    clearErrors()
    notice.value = ''
    if (!validateEmail()) return
    if (mode.value === 'password') {
      await loadChallenge('login')
      return
    }
    if (mode.value === 'register' && !validatePassword()) return
    if (mode.value === 'register' && !fields.consent) {
      fieldMessages.consent = () => t('flow.consentRequired')
      return
    }
    const isResetPassword = mode.value === 'reset' && resetVerification.value !== null
    if (isResetPassword) {
      if (!validatePassword()) return
      if (fields.password !== fields.confirmPassword) {
        fieldMessages.confirmPassword = () => t('flow.passwordMismatch')
        return
      }
    } else if (!validateCode()) return
    const email = normalizedEmail.value
    const operation = begin()
    try {
      if (mode.value === 'code') {
        const result = await getAdapter().login(
          { email, method: 'code', code: fields.code.trim() },
          operation.context(),
        )
        if (operation.current()) complete(result)
      } else if (mode.value === 'register') {
        const result = await getAdapter().register(
          { email, password: fields.password, code: fields.code.trim(), consent: fields.consent },
          operation.context(),
        )
        if (operation.current()) complete(result)
      } else if (!isResetPassword) {
        const result = await getAdapter().verifyResetCode(
          { email, code: fields.code.trim() },
          operation.context(),
        )
        if (!operation.current()) return
        ensureFresh(result, t('flow.emailVerification'))
        if (!result.token)
          throw new NovaError(NOVA_ERROR_CODES.RESET_INVALID, t('flow.resetInvalid'))
        resetVerification.value = result
        fields.password = ''
        fields.confirmPassword = ''
        fields.code = ''
      } else {
        const verification = resetVerification.value!
        ensureFresh(verification, t('flow.emailVerification'))
        await getAdapter().resetPassword(
          { email, password: fields.password, verificationToken: verification.token },
          operation.context(),
        )
        if (!operation.current()) return
        mode.value = 'password'
        notice.value = t('flow.resetDone')
        options.onReset?.()
      }
    } catch (cause) {
      if (operation.current()) {
        error.value = message(cause)
        const code = cause instanceof Error && 'code' in cause ? String(cause.code) : ''
        if (
          isResetPassword &&
          [
            NOVA_ERROR_CODES.VERIFICATION_EXPIRED,
            NOVA_ERROR_CODES.RESET_EXPIRED,
            NOVA_ERROR_CODES.RESET_INVALID,
            NOVA_ERROR_CODES.RESET_REQUIRED,
            NOVA_ERROR_CODES.CODE_EXPIRED,
          ].some((expired) => expired === code)
        ) {
          resetVerification.value = null
          delivery.value = null
          clearCredentials()
        }
      }
    } finally {
      if (operation.current()) busy.value = false
    }
  }

  function fill(
    values: Partial<Pick<typeof fields, 'email' | 'password' | 'code' | 'confirmPassword'>>,
  ) {
    if (busy.value || challengeOpen.value) cancel()
    if (values.email !== undefined) fields.email = values.email
    if (values.password !== undefined) fields.password = values.password
    if (values.confirmPassword !== undefined) fields.confirmPassword = values.confirmPassword
    if (values.code !== undefined) fields.code = values.code
    clearErrors()
  }

  return {
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
    submit,
    requestCode,
    verifyChallenge,
    retryChallenge,
    cancel,
    fill,
    tick,
  }
}
