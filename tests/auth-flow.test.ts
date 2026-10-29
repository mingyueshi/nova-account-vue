import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useAuthFlow, type AuthFlowOptions } from '../src/composables/useAuthFlow'
import type { AuthAdapter, AuthResult, CodeDelivery, Challenge, CaptchaProof } from '../src/types'

const user: AuthResult = {
  user: { id: 'user-1', email: 'person@example.test', displayName: 'Person' },
}
const deadline = 100_000
function createAdapter() {
  return {
    challenge: vi.fn<AuthAdapter['challenge']>(async () => ({
      id: 'challenge-1',
      kind: 'slider',
      expiresAt: deadline,
    })),
    verifyCaptcha: vi.fn<AuthAdapter['verifyCaptcha']>(async () => ({
      token: 'proof-1',
      expiresAt: deadline,
    })),
    sendCode: vi.fn<AuthAdapter['sendCode']>(async () => ({ expiresAt: deadline, retryAfter: 30 })),
    login: vi.fn<AuthAdapter['login']>(async () => user),
    register: vi.fn<AuthAdapter['register']>(async () => user),
    verifyResetCode: vi.fn<AuthAdapter['verifyResetCode']>(async () => ({
      token: 'reset-1',
      expiresAt: deadline,
    })),
    resetPassword: vi.fn<AuthAdapter['resetPassword']>(async () => {}),
    logout: vi.fn<AuthAdapter['logout']>(async () => {}),
  } satisfies AuthAdapter
}
const wrappers: VueWrapper[] = []
function setup(
  adapter: AuthAdapter | (() => AuthAdapter) = createAdapter(),
  options: AuthFlowOptions = {},
) {
  let flow!: ReturnType<typeof useAuthFlow>
  const wrapper = mount(
    defineComponent({
      setup() {
        flow = useAuthFlow(adapter, { now: () => 1_000, ...options })
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  flow.fill({ email: 'person@example.test', password: 'a-secret-password' })
  return flow
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('useAuthFlow', () => {
  it('does not challenge until password submit; chains proof to login and clears credentials', async () => {
    const adapter = createAdapter(),
      authenticated = vi.fn()
    const flow = setup(adapter, { onAuthenticated: authenticated })
    expect(adapter.challenge).not.toHaveBeenCalled()
    expect(flow.challengeOpen.value).toBe(false)
    await flow.submit()
    expect(adapter.challenge).toHaveBeenCalledTimes(1)
    expect(adapter.login).not.toHaveBeenCalled()
    expect(flow.challengeOpen.value).toBe(true)
    await flow.verifyChallenge({ value: 100 })
    expect(adapter.verifyCaptcha.mock.calls[0]?.[0]).toEqual({
      challengeId: 'challenge-1',
      email: 'person@example.test',
      purpose: 'login-password',
      response: { value: 100 },
    })
    expect(adapter.login.mock.calls[0]?.[0]).toEqual({
      email: 'person@example.test',
      method: 'password',
      password: 'a-secret-password',
      proof: 'proof-1',
    })
    expect(authenticated).toHaveBeenCalledExactlyOnceWith(user)
    expect(flow.fields.password).toBe('')
    expect(flow.challengeOpen.value).toBe(false)
  })

  it.each(['code', 'register', 'reset'] as const)(
    '%s sends code after challenge without a second challenge on submit',
    async (mode) => {
      const adapter = createAdapter(),
        reset = vi.fn(),
        authenticated = vi.fn()
      const flow = setup(adapter, { onReset: reset, onAuthenticated: authenticated })
      flow.mode.value = mode
      flow.fill({ password: 'new-password' })
      flow.fields.consent = true
      await flow.requestCode()
      expect(adapter.sendCode).not.toHaveBeenCalled()
      await flow.verifyChallenge({ value: 100 })
      const purpose =
        mode === 'code' ? 'login-code' : mode === 'reset' ? 'reset-password' : 'register'
      expect(adapter.sendCode.mock.calls[0]?.[0]).toEqual({
        email: 'person@example.test',
        purpose,
        proof: 'proof-1',
      })
      flow.fill({ code: '123456' })
      await flow.submit()
      if (mode === 'reset') {
        expect(flow.resetStage.value).toBe('password')
        expect(adapter.resetPassword).not.toHaveBeenCalled()
        flow.fill({ password: 'new-password', confirmPassword: 'new-password' })
        await flow.submit()
        expect(adapter.resetPassword.mock.calls[0]?.[0]).toEqual({
          email: 'person@example.test',
          password: 'new-password',
          verificationToken: 'reset-1',
        })
        expect(reset).toHaveBeenCalledTimes(1)
        expect(authenticated).not.toHaveBeenCalled()
        expect(flow.mode.value).toBe('password')
      } else expect(authenticated).toHaveBeenCalledTimes(1)
      expect(adapter.challenge).toHaveBeenCalledTimes(1)
      expect(adapter.verifyCaptcha).toHaveBeenCalledTimes(1)
    },
  )

  it('requires a code issued in the current flow and explicit registration consent', async () => {
    const adapter = createAdapter(),
      flow = setup(adapter)
    flow.mode.value = 'code'
    flow.fields.code = '123456'
    await flow.submit()
    expect(flow.fieldErrors.code).toContain('先获取')
    expect(adapter.login).not.toHaveBeenCalled()
    flow.mode.value = 'register'
    flow.fields.password = 'password'
    await flow.submit()
    expect(flow.fieldErrors.consent).toContain('同意')
    expect(adapter.register).not.toHaveBeenCalled()
  })

  it('ignores a challenge response after cancellation and aborts its signal', async () => {
    const adapter = createAdapter(),
      pending = deferred<Challenge>(),
      flow = setup(adapter)
    adapter.challenge.mockReturnValueOnce(pending.promise)
    const submit = flow.submit()
    const context = adapter.challenge.mock.calls[0]![1]
    flow.cancel()
    expect(context.signal.aborted).toBe(true)
    pending.resolve({ id: 'late', kind: 'slider', expiresAt: deadline })
    await submit
    expect(flow.challenge.value).toBe(null)
    expect(flow.challengeOpen.value).toBe(false)
    expect(flow.busy.value).toBe(false)
  })

  it('does not send a code when a cancelled verification resolves', async () => {
    const adapter = createAdapter(),
      pending = deferred<CaptchaProof>(),
      flow = setup(adapter)
    flow.mode.value = 'code'
    await flow.requestCode()
    adapter.verifyCaptcha.mockReturnValueOnce(pending.promise)
    const verify = flow.verifyChallenge({ value: 100 })
    flow.cancel()
    pending.resolve({ token: 'late-proof', expiresAt: deadline })
    await verify
    expect(adapter.sendCode).not.toHaveBeenCalled()
    expect(flow.delivery.value).toBe(null)
  })

  it('does not restore delivery UI from a cancelled in-flight send (server effect remains adapter-owned)', async () => {
    const adapter = createAdapter(),
      pending = deferred<CodeDelivery>(),
      flow = setup(adapter)
    flow.mode.value = 'register'
    await flow.requestCode()
    adapter.sendCode.mockReturnValueOnce(pending.promise)
    const verify = flow.verifyChallenge({ value: 100 })
    await Promise.resolve()
    expect(adapter.sendCode).toHaveBeenCalledTimes(1)
    flow.cancel()
    expect(adapter.sendCode.mock.calls[0]![1].signal.aborted).toBe(true)
    pending.resolve({ expiresAt: deadline, retryAfter: 30 })
    await verify
    expect(flow.delivery.value).toBe(null)
    expect(flow.notice.value).toBe('')
  })

  it.each(['email', 'mode'] as const)(
    '%s changes invalidate a pending reset verification and existing code',
    async (change) => {
      const adapter = createAdapter(),
        flow = setup(adapter)
      flow.mode.value = 'reset'
      await flow.requestCode()
      await flow.verifyChallenge({ value: 100 })
      flow.fields.code = '123456'
      const pending = deferred<{ token: string; expiresAt: number }>()
      adapter.verifyResetCode.mockReturnValueOnce(pending.promise)
      const submit = flow.submit()
      if (change === 'email') flow.fields.email = 'other@example.test'
      else flow.mode.value = 'code'
      pending.resolve({ token: 'late-reset', expiresAt: deadline })
      await submit
      expect(flow.delivery.value).toBe(null)
      expect(flow.resetStage.value).toBe('verify')
      expect(flow.fields.code).toBe('')
      expect(adapter.resetPassword).not.toHaveBeenCalled()
    },
  )

  it('adapter replacement cancels in-flight work instead of crossing service boundaries', async () => {
    const original = createAdapter(),
      replacement = createAdapter(),
      current = ref<AuthAdapter>(original)
    const pending = deferred<Challenge>()
    original.challenge.mockReturnValueOnce(pending.promise)
    const flow = setup(() => current.value)
    const submit = flow.submit()
    current.value = replacement
    pending.resolve({ id: 'old-adapter', kind: 'slider', expiresAt: deadline })
    await submit
    expect(flow.challenge.value).toBe(null)
    expect(original.challenge.mock.calls[0]![1].signal.aborted).toBe(true)
    expect(replacement.challenge).not.toHaveBeenCalled()
  })

  it('double verification does not duplicate adapter writes', async () => {
    const adapter = createAdapter(),
      pending = deferred<CaptchaProof>(),
      flow = setup(adapter)
    await flow.submit()
    adapter.verifyCaptcha.mockReturnValueOnce(pending.promise)
    const first = flow.verifyChallenge({ value: 100 }),
      second = flow.verifyChallenge({ value: 100 })
    pending.resolve({ token: 'proof', expiresAt: deadline })
    await Promise.all([first, second])
    expect(adapter.verifyCaptcha).toHaveBeenCalledTimes(1)
    expect(adapter.login).toHaveBeenCalledTimes(1)
  })

  it('rejects an expired proof before calling login', async () => {
    const adapter = createAdapter(),
      flow = setup(adapter)
    await flow.submit()
    adapter.verifyCaptcha.mockResolvedValueOnce({ token: 'expired', expiresAt: 999 })
    await flow.verifyChallenge({ value: 100 })
    expect(adapter.login).not.toHaveBeenCalled()
    expect(flow.challengeError.value).toContain('过期')
  })

  it('enforces cooldown and expiration boundaries without persisting state', async () => {
    let time = 1_000
    const adapter = createAdapter(),
      flow = setup(adapter, { now: () => time })
    flow.mode.value = 'code'
    await flow.requestCode()
    await flow.verifyChallenge({ value: 100 })
    expect(flow.resendSeconds.value).toBe(30)
    await flow.requestCode()
    expect(adapter.challenge).toHaveBeenCalledTimes(1)
    time = 31_000
    flow.tick()
    expect(flow.resendSeconds.value).toBe(0)
    time = deadline
    flow.tick()
    flow.fields.code = '123456'
    await flow.submit()
    expect(flow.codeExpired.value).toBe(true)
    expect(flow.fieldErrors.code).toContain('过期')
    expect(adapter.login).not.toHaveBeenCalled()
  })

  it('does not share credentials, challenges or delivery between instances', async () => {
    const adapterA = createAdapter(),
      adapterB = createAdapter(),
      flowA = setup(adapterA),
      flowB = setup(adapterB)
    flowA.mode.value = 'code'
    await flowA.requestCode()
    await flowA.verifyChallenge({ value: 100 })
    expect(flowB.delivery.value).toBe(null)
    expect(flowB.mode.value).toBe('password')
    flowA.fill({ password: 'changed' })
    expect(flowB.fields.password).toBe('a-secret-password')
    expect(adapterA.challenge.mock.calls[0]![1].requestId).not.toBe(
      adapterB.challenge.mock.calls[0]?.[1].requestId,
    )
  })

  it('unmount aborts requests and wipes form credentials', async () => {
    const adapter = createAdapter(),
      pending = deferred<AuthResult>(),
      authenticated = vi.fn(),
      flow = setup(adapter, { onAuthenticated: authenticated })
    await flow.submit()
    adapter.login.mockReturnValueOnce(pending.promise)
    const verify = flow.verifyChallenge({ value: 100 })
    await Promise.resolve()
    wrappers.pop()!.unmount()
    expect(flow.fields.password).toBe('')
    expect(flow.fields.email).toBe('')
    expect(adapter.login.mock.calls[0]![1].signal.aborted).toBe(true)
    pending.resolve(user)
    await verify
    expect(authenticated).not.toHaveBeenCalled()
  })

  it('keeps a failed submission retryable and never emits fake success', async () => {
    const adapter = createAdapter(),
      authenticated = vi.fn(),
      flow = setup(adapter, { onAuthenticated: authenticated })
    flow.mode.value = 'code'
    await flow.requestCode()
    await flow.verifyChallenge({ value: 100 })
    flow.fields.code = '123456'
    adapter.login.mockRejectedValueOnce(new Error('Service unavailable'))
    await flow.submit()
    expect(flow.error.value).toBe('Service unavailable')
    expect(flow.busy.value).toBe(false)
    expect(authenticated).not.toHaveBeenCalled()
    await flow.submit()
    expect(authenticated).toHaveBeenCalledTimes(1)
    expect(adapter.challenge).toHaveBeenCalledTimes(1)
  })

  it('requires a new email verification after a reset token expires', async () => {
    let time = 1_000
    const adapter = createAdapter(),
      flow = setup(adapter, { now: () => time })
    flow.mode.value = 'reset'
    await flow.requestCode()
    await flow.verifyChallenge({ value: 100 })
    flow.fields.code = '123456'
    await flow.submit()
    expect(flow.resetStage.value).toBe('password')
    flow.fill({ password: 'new-password', confirmPassword: 'new-password' })
    time = deadline
    await flow.submit()
    expect(adapter.resetPassword).not.toHaveBeenCalled()
    expect(flow.resetStage.value).toBe('verify')
    expect(flow.delivery.value).toBe(null)
    expect(flow.error.value).toContain('过期')
  })

  it('rejects confirmation mismatch without submitting a reset', async () => {
    const adapter = createAdapter(),
      flow = setup(adapter)
    flow.mode.value = 'reset'
    await flow.requestCode()
    await flow.verifyChallenge({ value: 100 })
    flow.fields.code = '123456'
    await flow.submit()
    flow.fill({ password: 'new-password', confirmPassword: 'different-password' })
    await flow.submit()
    expect(adapter.resetPassword).not.toHaveBeenCalled()
    expect(flow.fieldErrors.confirmPassword).toContain('不一致')
    expect(adapter.challenge).toHaveBeenCalledTimes(1)
  })

  it('can explicitly reload a failed challenge without automatic network retries', async () => {
    const adapter = createAdapter(),
      flow = setup(adapter)
    adapter.challenge.mockRejectedValueOnce(new Error('Temporarily unavailable'))
    await flow.submit()
    expect(flow.challengeError.value).toBe('Temporarily unavailable')
    expect(adapter.challenge).toHaveBeenCalledTimes(1)
    await flow.retryChallenge()
    expect(adapter.challenge).toHaveBeenCalledTimes(2)
    expect(flow.challengeError.value).toBe('')
    expect(flow.challenge.value?.id).toBe('challenge-1')
  })
})

describe('countdowns and page visibility', () => {
  it('pauses hidden-page timers and immediately reconciles elapsed cooldown on return', async () => {
    vi.useFakeTimers()
    let current = 1_000
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    try {
      const flow = setup(createAdapter(), { now: () => current })
      flow.mode.value = 'code'
      await flow.requestCode()
      await flow.verifyChallenge({ value: 100 })
      expect(flow.resendSeconds.value).toBe(30)
      hidden.mockReturnValue(true)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(vi.getTimerCount()).toBe(0)
      current += 31_000
      vi.advanceTimersByTime(31_000)
      expect(flow.resendSeconds.value).toBe(30)
      hidden.mockReturnValue(false)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(flow.resendSeconds.value).toBe(0)
      expect(vi.getTimerCount()).toBe(1)
      wrappers.pop()!.unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      hidden.mockRestore()
    }
  })
})
