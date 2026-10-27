import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { NovaError } from '../types'
import type { AuthAdapter, AuthMode, AuthResult, CaptchaPurpose, Challenge, CodeDelivery, CodePurpose, RequestContext, ResetVerification } from '../types'

export interface AuthFlowOptions {
  onAuthenticated?: (result: AuthResult) => void
  onReset?: () => void
  now?: () => number
}

/** Per-component presentation flow. An aborted HTTP request is not proof of server rollback. */
export function useAuthFlow(adapter: AuthAdapter | (() => AuthAdapter), options: AuthFlowOptions = {}) {
  const getAdapter = () => typeof adapter === 'function' ? adapter() : adapter
  const now = options.now ?? Date.now
  const mode = ref<AuthMode>('password')
  const fields = reactive({ email: '', password: '', confirmPassword: '', code: '', consent: false })
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const fieldErrors = reactive({ email: '', password: '', confirmPassword: '', code: '', consent: '' })
  const challenge = shallowRef<Challenge | null>(null)
  const challengeOpen = ref(false)
  const challengeError = ref('')
  const delivery = shallowRef<CodeDelivery | null>(null)
  const resetVerification = shallowRef<ResetVerification | null>(null)
  const resetStage = computed(() => resetVerification.value ? 'password' : 'verify')
  const clock = ref(now())
  const resendAt = ref(0)
  const resendSeconds = computed(() => Math.max(0, Math.ceil((resendAt.value - clock.value) / 1000)))
  const codeExpired = computed(() => !!delivery.value && delivery.value.expiresAt <= clock.value)
  const normalizedEmail = computed(() => fields.email.trim().toLowerCase())
  const purpose = computed<CaptchaPurpose>(() => ({ password: 'login-password', code: 'login-code', register: 'register', reset: 'reset-password' } as const)[mode.value])
  let generation = 0
  let controller: AbortController | null = null
  let sequence = 0
  // Correlation only, never a security credential or a durable idempotency key.
  const requestPrefix = `nova-${now().toString(36)}-${Math.random().toString(36).slice(2)}`
  let action: 'login' | 'send-code' | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false

  function tick() { clock.value = now() }
  onMounted(() => { tick(); timer = setInterval(tick, 1000) })
  onScopeDispose(() => { disposed = true; clearInterval(timer); invalidate(); fields.email = ''; clearCredentials() })

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
    Object.keys(fieldErrors).forEach(key => { fieldErrors[key as keyof typeof fieldErrors] = '' })
  }
  function clearCredentials() { fields.password = ''; fields.confirmPassword = ''; fields.code = ''; fields.consent = false }
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
  watch(mode, () => { invalidate(); clearCredentials() }, { flush: 'sync' })
  watch(getAdapter, () => { invalidate(); clearCredentials() }, { flush: 'sync' })

  function validateEmail() {
    const valid = normalizedEmail.value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.value)
    fieldErrors.email = valid ? '' : '请输入有效的邮箱地址。'
    return valid
  }
  function validatePassword() {
    fieldErrors.password = fields.password.length > 0 && fields.password.length <= 1024 ? '' : '请输入密码（最多 1024 个字符）。'
    return !fieldErrors.password
  }
  function validateCode() {
    fieldErrors.code = fields.code.trim() ? '' : '请输入邮箱验证码。'
    if (!delivery.value) fieldErrors.code = '请先获取当前流程的验证码。'
    else if (delivery.value.expiresAt <= now()) fieldErrors.code = '验证码已过期，请重新获取。'
    return !fieldErrors.code
  }
  function message(cause: unknown) { return cause instanceof Error ? cause.message : '操作未完成，请稍后重试。' }
  function ensureFresh(token: { expiresAt: number }, label: string) {
    if (!Number.isFinite(token.expiresAt) || token.expiresAt <= now()) throw new NovaError('VERIFICATION_EXPIRED', `${label}已过期，请重新验证。`)
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
      const result = await getAdapter().challenge({ email: normalizedEmail.value, purpose: purpose.value }, operation.context())
      if (!operation.current()) return
      ensureFresh(result, '验证挑战')
      if (!result.id || !['slider', 'custom'].includes(result.kind)) throw new NovaError('CHALLENGE_INVALID', '验证挑战不可用，请联系服务提供方。')
      challenge.value = result
    } catch (cause) {
      if (operation.current()) challengeError.value = message(cause)
    } finally { if (operation.current()) busy.value = false }
  }
  async function requestCode() { if (!challengeOpen.value) await loadChallenge('send-code') }
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
      ensureFresh(currentChallenge, '验证挑战')
      const proof = await getAdapter().verifyCaptcha({ challengeId: currentChallenge.id, email, purpose: boundPurpose, response }, operation.context())
      if (!operation.current()) return
      ensureFresh(proof, '验证凭证')
      if (!proof.token) throw new NovaError('PROOF_INVALID', '验证服务未返回有效凭证。')
      if (currentAction === 'send-code') {
        if (boundPurpose === 'login-password') throw new NovaError('PURPOSE_INVALID', '当前流程不支持发送验证码。')
        const result = await getAdapter().sendCode({ email, purpose: boundPurpose as CodePurpose, proof: proof.token }, operation.context())
        if (!operation.current()) return
        ensureFresh(result, '验证码')
        if (!Number.isFinite(result.retryAfter) || result.retryAfter < 0) throw new NovaError('DELIVERY_INVALID', '验证码发送结果不可用，请核实后重试。')
        delivery.value = result
        resendAt.value = now() + result.retryAfter * 1000
        tick()
        cancel()
        notice.value = '验证码已发出，请查看邮箱。'
      } else {
        const result = await getAdapter().login({ email, method: 'password', password: fields.password, proof: proof.token }, operation.context())
        if (operation.current()) complete(result)
      }
    } catch (cause) {
      if (operation.current()) challengeError.value = message(cause)
    } finally { if (operation.current()) busy.value = false }
  }

  async function submit() {
    if (busy.value || challengeOpen.value || disposed) return
    clearErrors()
    notice.value = ''
    if (!validateEmail()) return
    if (mode.value === 'password') { await loadChallenge('login'); return }
    if (mode.value === 'register' && !validatePassword()) return
    if (mode.value === 'register' && !fields.consent) { fieldErrors.consent = '请先阅读并同意服务条款与隐私说明。'; return }
    const isResetPassword = mode.value === 'reset' && resetVerification.value !== null
    if (isResetPassword) {
      if (!validatePassword()) return
      if (fields.password !== fields.confirmPassword) { fieldErrors.confirmPassword = '两次输入的密码不一致。'; return }
    } else if (!validateCode()) return
    const email = normalizedEmail.value
    const operation = begin()
    try {
      if (mode.value === 'code') {
        const result = await getAdapter().login({ email, method: 'code', code: fields.code.trim() }, operation.context())
        if (operation.current()) complete(result)
      } else if (mode.value === 'register') {
        const result = await getAdapter().register({ email, password: fields.password, code: fields.code.trim(), consent: fields.consent }, operation.context())
        if (operation.current()) complete(result)
      } else if (!isResetPassword) {
        const result = await getAdapter().verifyResetCode({ email, code: fields.code.trim() }, operation.context())
        if (!operation.current()) return
        ensureFresh(result, '邮箱验证')
        if (!result.token) throw new NovaError('RESET_INVALID', '邮箱验证未返回有效凭证。')
        resetVerification.value = result
        fields.password = ''; fields.confirmPassword = ''; fields.code = ''
      } else {
        const verification = resetVerification.value!
        ensureFresh(verification, '邮箱验证')
        await getAdapter().resetPassword({ email, password: fields.password, verificationToken: verification.token }, operation.context())
        if (!operation.current()) return
        mode.value = 'password'
        notice.value = '密码已重置，请重新登录。'
        options.onReset?.()
      }
    } catch (cause) {
      if (operation.current()) {
        error.value = message(cause)
        const code = cause instanceof Error && 'code' in cause ? String(cause.code) : ''
        if (isResetPassword && ['VERIFICATION_EXPIRED', 'RESET_EXPIRED', 'RESET_INVALID', 'RESET_REQUIRED', 'CODE_EXPIRED'].includes(code)) {
          resetVerification.value = null
          delivery.value = null
          clearCredentials()
        }
      }
    } finally { if (operation.current()) busy.value = false }
  }

  function fill(values: Partial<Pick<typeof fields, 'email' | 'password' | 'code' | 'confirmPassword'>>) {
    if (busy.value || challengeOpen.value) cancel()
    if (values.email !== undefined) fields.email = values.email
    if (values.password !== undefined) fields.password = values.password
    if (values.confirmPassword !== undefined) fields.confirmPassword = values.confirmPassword
    if (values.code !== undefined) fields.code = values.code
    clearErrors()
  }

  return { mode, fields, busy, error, notice, fieldErrors, challenge, challengeOpen, challengeError, delivery, resetStage, resendSeconds, codeExpired, submit, requestCode, verifyChallenge, retryChallenge, cancel, fill, tick }
}
