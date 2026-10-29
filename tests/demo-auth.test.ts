import { describe, expect, it } from 'vitest'
import { createDemoAuthAdapter, DEMO_EMAIL, DEMO_PASSWORD, DEMO_CODE } from '../demo/auth'
import type { CaptchaPurpose, RequestContext } from '../src/types'
const context = (): RequestContext => ({ signal: new AbortController().signal, requestId: 'test' })
const options = { delay: async () => {} }
async function proof(
  adapter: ReturnType<typeof createDemoAuthAdapter>,
  purpose: CaptchaPurpose = 'register',
) {
  const challenge = await adapter.challenge({ email: DEMO_EMAIL, purpose }, context())
  return adapter.verifyCaptcha(
    { email: DEMO_EMAIL, purpose, challengeId: challenge.id, response: { value: 100 } },
    context(),
  )
}
describe('standalone mock auth boundaries', () => {
  it('rejects real addresses and passwords', async () => {
    const adapter = createDemoAuthAdapter(options)
    await expect(
      adapter.challenge({ email: 'real@example.com', purpose: 'register' }, context()),
    ).rejects.toMatchObject({ code: 'DEMO_ONLY' })
    await expect(
      adapter.login(
        { email: DEMO_EMAIL, method: 'password', password: 'realpassword', proof: 'none' },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'DEMO_ONLY' })
  })
  it('binds and spends proof once before sending', async () => {
    const adapter = createDemoAuthAdapter(options),
      token = await proof(adapter)
    await expect(
      adapter.sendCode({ email: DEMO_EMAIL, purpose: 'login-code', proof: token.token }, context()),
    ).rejects.toMatchObject({ code: 'PROOF_BINDING' })
    const delivery = await adapter.sendCode(
      { email: DEMO_EMAIL, purpose: 'register', proof: token.token },
      context(),
    )
    expect(delivery.demoCode).toBe(DEMO_CODE)
    await expect(
      adapter.sendCode({ email: DEMO_EMAIL, purpose: 'register', proof: token.token }, context()),
    ).rejects.toMatchObject({ code: 'PROOF_BINDING' })
  })
  it('purpose-bound codes are consumed on successful register', async () => {
    const adapter = createDemoAuthAdapter(options),
      token = await proof(adapter)
    await adapter.sendCode(
      { email: DEMO_EMAIL, purpose: 'register', proof: token.token },
      context(),
    )
    await expect(
      adapter.login({ email: DEMO_EMAIL, method: 'code', code: DEMO_CODE }, context()),
    ).rejects.toMatchObject({ code: 'CODE_BINDING' })
    await adapter.register(
      { email: DEMO_EMAIL, password: DEMO_PASSWORD, code: DEMO_CODE, consent: true },
      context(),
    )
    await expect(
      adapter.register(
        { email: DEMO_EMAIL, password: DEMO_PASSWORD, code: DEMO_CODE, consent: true },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'CODE_BINDING' })
  })
  it('cancelled pending sends cannot create a mock code', async () => {
    let release!: () => void
    let block = false
    const adapter = createDemoAuthAdapter({
      delay: () =>
        block
          ? new Promise<void>((resolve) => {
              release = resolve
            })
          : Promise.resolve(),
    })
    const token = await proof(adapter)
    block = true
    const controller = new AbortController()
    const pending = adapter.sendCode(
      { email: DEMO_EMAIL, purpose: 'register', proof: token.token },
      { signal: controller.signal, requestId: 'cancel' },
    )
    controller.abort()
    release()
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
    block = false
    await expect(
      adapter.register(
        { email: DEMO_EMAIL, password: DEMO_PASSWORD, code: DEMO_CODE, consent: true },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'CODE_BINDING' })
  })
  it('rejects expired proofs', async () => {
    let time = 1000
    const adapter = createDemoAuthAdapter({ ...options, now: () => time }),
      token = await proof(adapter)
    time += 45_000
    await expect(
      adapter.sendCode({ email: DEMO_EMAIL, purpose: 'register', proof: token.token }, context()),
    ).rejects.toMatchObject({ code: 'PROOF_EXPIRED' })
  })
})
