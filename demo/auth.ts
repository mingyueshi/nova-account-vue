import { NovaError } from '../src/types'
import type { AuthAdapter, CaptchaPurpose, CodePurpose, RequestContext } from '../src/types'
export const DEMO_EMAIL = 'demo@nova.example'
/** `identifier="username"` collects this value; the wire contract stays on `email`. */
export const DEMO_USERNAME = 'demo'
export const DEMO_PASSWORD = 'NovaDemo2026!'
export const DEMO_CODE = '246810'
export const DEMO_NEXT_PASSWORD = 'NovaNext2026!'
export const DEMO_NEXT_EMAIL = 'novanext@nova.example'
export interface DemoSettings {
  network: 'normal' | 'slow' | 'offline'
  captcha: 'normal' | 'fail' | 'expired'
  /** `slider` renders the built-in slider; `math` exercises the host `#captcha` slot. */
  challenge: 'slider' | 'math'
  code: 'normal' | 'expired'
  auth: 'normal' | 'fail'
  /** `limited` rejects further sends for a window to demonstrate `retryAfter`-style throttling. */
  rate: 'normal' | 'limited'
  /** `dirty` applies one simulated external edit so the next mutation reports a revision conflict. */
  conflict: 'normal' | 'dirty'
  /** Presentation limit mirrored by the auth form `codeLength` prop. */
  codeLength: 4 | 6 | null
}
export const defaultSettings = (): DemoSettings => ({
  network: 'normal',
  captcha: 'normal',
  challenge: 'slider',
  code: 'normal',
  auth: 'normal',
  rate: 'normal',
  conflict: 'normal',
  codeLength: 6,
})
/** Demo code follows the presented code length; `null` keeps the full six digits. */
export const demoCode = (codeLength: 4 | 6 | null = 6) =>
  codeLength ? DEMO_CODE.slice(0, codeLength) : DEMO_CODE
export const demoUser = () => ({ id: 'nova-demo', email: DEMO_EMAIL, displayName: 'Nova' })
export function fail(code: string, message: string): never {
  throw new NovaError(code, message)
}
export function assertActive(context: RequestContext) {
  if (context.signal.aborted) fail('CANCELLED', '操作已取消。')
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
export function createDemoAuthAdapter(
  options: {
    settings?: () => DemoSettings
    now?: () => number
    delay?: (ms: number) => Promise<void>
  } = {},
): AuthAdapter {
  const settings = options.settings ?? defaultSettings
  const now = options.now ?? Date.now
  const delay = options.delay ?? sleep
  let sequence = 0
  let challenge: {
    id: string
    email: string
    purpose: CaptchaPurpose
    expiresAt: number
    kind: 'slider' | 'custom'
    answer?: number
  } | null = null
  let proof: { token: string; email: string; purpose: CaptchaPurpose; expiresAt: number } | null =
    null
  let delivery: {
    issue: number
    email: string
    purpose: CodePurpose
    expiresAt: number
    resendAt: number
    resetToken?: string
  } | null = null
  let rateUntil = 0
  function email(value: string) {
    const trimmed = value.trim()
    if (trimmed.toLowerCase() !== DEMO_EMAIL && trimmed !== DEMO_USERNAME)
      fail(
        'DEMO_ONLY',
        `请使用示例邮箱 ${DEMO_EMAIL} 或示例账号 ${DEMO_USERNAME}，勿填写真实资料。`,
      )
    return DEMO_EMAIL
  }
  function password(value: string, next = false) {
    if (value !== DEMO_PASSWORD && !(next && value === DEMO_NEXT_PASSWORD))
      fail('DEMO_ONLY', `此演示仅接受合成密码 ${next ? DEMO_NEXT_PASSWORD : DEMO_PASSWORD}。`)
  }
  async function wait(context: RequestContext, business = false) {
    assertActive(context)
    const config = { ...settings() }
    await delay(config.network === 'slow' ? 3000 : 350)
    assertActive(context)
    if (config.network === 'offline')
      fail('NETWORK', '模拟网络不可用，请在体验工具恢复正常后重试。')
    if (business && config.auth === 'fail') fail('REJECTED', '模拟请求被拒绝，状态未改变。')
    return config
  }
  function checkProof(token: string, address: string, purpose: CaptchaPurpose) {
    if (!proof || proof.token !== token || proof.email !== address || proof.purpose !== purpose)
      fail('PROOF_BINDING', '验证凭证不属于当前邮箱或操作。')
    if (now() >= proof.expiresAt) fail('PROOF_EXPIRED', '验证已过期，请重新验证。')
  }
  function checkCode(
    code: string,
    address: string,
    purpose: CodePurpose,
    issue: number | undefined,
  ) {
    if (
      !delivery ||
      delivery.issue !== issue ||
      delivery.email !== address ||
      delivery.purpose !== purpose
    )
      fail('CODE_BINDING', '请先获取当前操作的演示验证码。')
    if (settings().code === 'expired' || now() >= delivery.expiresAt)
      fail('CODE_EXPIRED', '演示验证码已过期，请重新获取。')
    const expected = demoCode(settings().codeLength)
    if (code !== expected) fail('CODE_INVALID', `演示验证码为 ${expected}。`)
  }
  return {
    async challenge(input, context) {
      const address = email(input.email)
      const id = `demo-challenge-${++sequence}`
      challenge = null
      proof = null
      const config = await wait(context)
      const base = { id, email: address, purpose: input.purpose, expiresAt: now() + 45_000 }
      if (config.challenge === 'math') {
        const left = 6 + Math.floor(Math.random() * 4)
        const right = 6 + Math.floor(Math.random() * 4)
        challenge = { ...base, kind: 'custom', answer: left * right }
        return { ...challenge, label: `请计算 ${left} × ${right} 的结果` }
      }
      challenge = { ...base, kind: 'slider' }
      return { ...challenge, label: '滑动完成演示验证' }
    },
    async verifyCaptcha(input, context) {
      const address = email(input.email)
      const config = await wait(context)
      if (
        !challenge ||
        challenge.id !== input.challengeId ||
        challenge.email !== address ||
        challenge.purpose !== input.purpose
      )
        fail('CHALLENGE_BINDING', '验证已失效，请重新开始。')
      if (config.captcha === 'expired' || now() >= challenge.expiresAt)
        fail('CHALLENGE_EXPIRED', '演示验证已过期，请关闭后重试。')
      const response = input.response as { value?: unknown; answer?: unknown } | null
      if (challenge.kind === 'custom') {
        const answer = Number(response?.answer)
        if (
          config.captcha === 'fail' ||
          !response ||
          !Number.isInteger(answer) ||
          answer !== challenge.answer
        )
          fail('CHALLENGE_FAILED', `演示计算未通过（正确答案 ${challenge.answer}），请换一题重试。`)
      } else if (config.captcha === 'fail' || !response || response.value !== 100)
        fail('CHALLENGE_FAILED', '演示验证未通过，请重试。')
      proof = {
        token: `demo-proof-${++sequence}`,
        email: address,
        purpose: input.purpose,
        expiresAt: now() + 45_000,
      }
      challenge = null
      return { token: proof.token, expiresAt: proof.expiresAt }
    },
    async sendCode(input, context) {
      const address = email(input.email)
      const config = await wait(context, true)
      checkProof(input.proof, address, input.purpose)
      if (config.rate === 'limited') {
        if (now() < rateUntil)
          fail(
            'RATE_LIMITED',
            `发送过于频繁（模拟限流），请约 ${Math.max(1, Math.ceil((rateUntil - now()) / 1000))} 秒后再试。`,
          )
        rateUntil = now() + 20_000
      }
      if (delivery && now() < delivery.resendAt) fail('COOLDOWN', '请稍后再获取验证码。')
      proof = null
      delivery = {
        issue: ++sequence,
        email: address,
        purpose: input.purpose,
        expiresAt: now() + 120_000,
        resendAt: now() + 30_000,
      }
      return {
        expiresAt: delivery.expiresAt,
        retryAfter: 30,
        demoCode: demoCode(config.codeLength),
      }
    },
    async login(input, context) {
      const address = email(input.email),
        issue = delivery?.issue
      if (input.method === 'password') password(input.password)
      await wait(context, true)
      if (input.method === 'password') {
        checkProof(input.proof, address, 'login-password')
        proof = null
      } else {
        checkCode(input.code, address, 'login-code', issue)
        delivery = null
      }
      return { user: demoUser() }
    },
    async register(input, context) {
      const address = email(input.email),
        issue = delivery?.issue
      password(input.password)
      if (!input.consent) fail('CONSENT', '请先同意演示条款。')
      await wait(context, true)
      checkCode(input.code, address, 'register', issue)
      delivery = null
      return { user: demoUser() }
    },
    async verifyResetCode(input, context) {
      const address = email(input.email),
        issue = delivery?.issue
      await wait(context, true)
      checkCode(input.code, address, 'reset-password', issue)
      delivery!.resetToken = `demo-reset-${++sequence}`
      return { token: delivery!.resetToken, expiresAt: delivery!.expiresAt }
    },
    async resetPassword(input, context) {
      const address = email(input.email),
        issue = delivery?.issue
      password(input.password, true)
      await wait(context, true)
      if (
        !delivery ||
        delivery.issue !== issue ||
        delivery.email !== address ||
        delivery.purpose !== 'reset-password' ||
        input.verificationToken !== delivery.resetToken ||
        !delivery.resetToken
      )
        fail('RESET_BINDING', '请先验证当前邮箱。')
      if (now() >= delivery.expiresAt || settings().code === 'expired')
        fail('RESET_EXPIRED', '邮箱验证已过期，请重新开始。')
      delivery = null
    },
    async logout(context) {
      await wait(context, true)
      challenge = null
      proof = null
      delivery = null
    },
  }
}
