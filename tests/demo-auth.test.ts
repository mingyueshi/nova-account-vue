import { describe, expect, it } from 'vitest'
import {
  createDemoAuthAdapter,
  createDemoIdentities,
  defaultSettings,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CODE,
} from '../demo/auth'
import { createDemoAccountAdapter, DEMO_ACCOUNT_VALUES } from '../demo/account'
import type { CaptchaPurpose, RequestContext } from '../src/types'
const context = (): RequestContext => ({ signal: new AbortController().signal, requestId: 'test' })
const options = { delay: async () => {} }
async function proof(
  adapter: ReturnType<typeof createDemoAuthAdapter>,
  purpose: CaptchaPurpose = 'register',
  address = DEMO_EMAIL,
) {
  const challenge = await adapter.challenge({ email: address, purpose }, context())
  return adapter.verifyCaptcha(
    { email: address, purpose, challengeId: challenge.id, response: { value: 100 } },
    context(),
  )
}
describe('standalone mock auth boundaries', () => {
  it('allows registration addresses and rejects incorrect credentials without exposing fixtures', async () => {
    const adapter = createDemoAuthAdapter(options)
    await expect(
      adapter.challenge({ email: 'new@demo.com', purpose: 'register' }, context()),
    ).resolves.toHaveProperty('id')
    const token = await proof(adapter, 'login-password')
    await expect(
      adapter.login(
        { email: DEMO_EMAIL, method: 'password', password: 'wrong', proof: token.token },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'CREDENTIALS_INVALID', message: '账号或密码不正确。' })
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
    expect(delivery).not.toHaveProperty('demoCode')
    await expect(
      adapter.sendCode({ email: DEMO_EMAIL, purpose: 'register', proof: token.token }, context()),
    ).rejects.toMatchObject({ code: 'PROOF_BINDING' })
  })
  it('purpose-bound codes are consumed on successful register', async () => {
    const address = 'new@demo.com'
    const adapter = createDemoAuthAdapter(options),
      token = await proof(adapter, 'register', address)
    await adapter.sendCode({ email: address, purpose: 'register', proof: token.token }, context())
    await expect(
      adapter.login({ email: address, method: 'code', code: DEMO_CODE }, context()),
    ).rejects.toMatchObject({ code: 'CODE_BINDING' })
    await adapter.register(
      { email: address, password: DEMO_PASSWORD, code: DEMO_CODE, consent: true },
      context(),
    )
    await expect(
      adapter.register(
        { email: address, password: DEMO_PASSWORD, code: DEMO_CODE, consent: true },
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
  it('throttles further sends after the first success when rate limiting is on', async () => {
    let time = 1000
    const adapter = createDemoAuthAdapter({
      ...options,
      now: () => time,
      settings: () => ({ ...defaultSettings(), rate: 'limited' }),
    })
    const first = await adapter.sendCode(
      { email: DEMO_EMAIL, purpose: 'register', proof: (await proof(adapter)).token },
      context(),
    )
    expect(first).not.toHaveProperty('demoCode')
    time += 5_000
    await expect(
      adapter.sendCode(
        { email: DEMO_EMAIL, purpose: 'register', proof: (await proof(adapter)).token },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    time += 30_000
    const retry = await adapter.sendCode(
      { email: DEMO_EMAIL, purpose: 'register', proof: (await proof(adapter)).token },
      context(),
    )
    expect(retry).not.toHaveProperty('demoCode')
  })
})

describe('consumer demo account lifecycle', () => {
  it('keeps a registered identity after logout and adapter recreation', async () => {
    const identities = createDemoIdentities()
    const adapter = createDemoAuthAdapter({ ...options, identities })
    const address = 'new@demo.com'
    await adapter.sendCode(
      {
        email: address,
        purpose: 'register',
        proof: (await proof(adapter, 'register', address)).token,
      },
      context(),
    )
    const registered = await adapter.register(
      { email: address, password: '654321', code: DEMO_CODE, consent: true },
      context(),
    )
    expect(registered.user.email).toBe(address)
    expect(registered.user.id).not.toBe('nova-demo')
    await adapter.logout(context())
    const next = createDemoAuthAdapter({ ...options, identities })
    const signedIn = await next.login(
      {
        email: address,
        method: 'password',
        password: '654321',
        proof: (await proof(next, 'login-password', address)).token,
      },
      context(),
    )
    expect(signedIn.user).toEqual(registered.user)
    await next.sendCode(
      {
        email: address,
        purpose: 'register',
        proof: (await proof(next, 'register', address)).token,
      },
      context(),
    )
    await expect(
      next.register(
        { email: address, password: '123456', code: DEMO_CODE, consent: true },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' })
  })
  it('replaces the actual password when resetting it', async () => {
    const adapter = createDemoAuthAdapter(options)
    await adapter.sendCode(
      {
        email: DEMO_EMAIL,
        purpose: 'reset-password',
        proof: (await proof(adapter, 'reset-password')).token,
      },
      context(),
    )
    const verified = await adapter.verifyResetCode(
      { email: DEMO_EMAIL, code: DEMO_CODE },
      context(),
    )
    await adapter.resetPassword(
      { email: DEMO_EMAIL, password: '654321', verificationToken: verified.token },
      context(),
    )
    await expect(
      adapter.login(
        {
          email: DEMO_EMAIL,
          method: 'password',
          password: DEMO_PASSWORD,
          proof: (await proof(adapter, 'login-password')).token,
        },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'CREDENTIALS_INVALID' })
    await expect(
      adapter.login(
        {
          email: DEMO_EMAIL,
          method: 'password',
          password: '654321',
          proof: (await proof(adapter, 'login-password')).token,
        },
        context(),
      ),
    ).resolves.toMatchObject({ user: { email: DEMO_EMAIL } })
  })
})

it('shares account password and email mutations with later authentication', async () => {
  const identities = createDemoIdentities()
  const account = createDemoAccountAdapter({ identities, wait: async () => {} })
  let snapshot = await account.load(context())
  snapshot = await account.changePassword(DEMO_ACCOUNT_VALUES, {
    ...context(),
    revision: snapshot.revision,
  })
  await account.requestEmailChangeCode!(
    { email: 'next@demo.com', currentPassword: '654321' },
    context(),
  )
  await account.changeEmail(
    { email: 'next@demo.com', code: DEMO_CODE },
    { ...context(), revision: snapshot.revision },
  )
  const reloaded = createDemoAccountAdapter({ identities, wait: async () => {} })
  expect((await reloaded.load(context())).email).toBe('next@demo.com')
  const adapter = createDemoAuthAdapter({ ...options, identities })
  await expect(
    adapter.login(
      {
        email: 'next@demo.com',
        method: 'password',
        password: '654321',
        proof: (await proof(adapter, 'login-password', 'next@demo.com')).token,
      },
      context(),
    ),
  ).resolves.toMatchObject({ user: { email: 'next@demo.com' } })
  await expect(
    adapter.login(
      {
        email: DEMO_EMAIL,
        method: 'password',
        password: '654321',
        proof: (await proof(adapter, 'login-password')).token,
      },
      context(),
    ),
  ).rejects.toMatchObject({ code: 'CREDENTIALS_INVALID' })
})

it('removes only the active identity when deleting an account', async () => {
  const identities = createDemoIdentities()
  identities.register('new@demo.com', '654321')
  identities.removeCurrent()
  const adapter = createDemoAuthAdapter({ ...options, identities })
  await expect(
    adapter.login(
      {
        email: 'new@demo.com',
        method: 'password',
        password: '654321',
        proof: (await proof(adapter, 'login-password', 'new@demo.com')).token,
      },
      context(),
    ),
  ).rejects.toMatchObject({ code: 'CREDENTIALS_INVALID' })
  await expect(
    adapter.login(
      {
        email: DEMO_EMAIL,
        method: 'password',
        password: DEMO_PASSWORD,
        proof: (await proof(adapter, 'login-password')).token,
      },
      context(),
    ),
  ).resolves.toHaveProperty('user.email', DEMO_EMAIL)
})
