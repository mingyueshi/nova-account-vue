import { describe, expect, it, vi } from 'vitest'
import { createDemoAccountAdapter, DEMO_ACCOUNT_VALUES } from '../demo/account'
import { useAccount } from '../src/composables/useAccount'
import { effectScope, shallowRef } from 'vue'
import type { AccountAdapter, MutationContext, RequestContext } from '../src/types'

let sequence = 0
function context(revision = '0'): MutationContext {
  return { revision, signal: new AbortController().signal, requestId: `test-${++sequence}` }
}
const instant = () => Promise.resolve()
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('exported account getter replacement', () => {
  it('aborts pending old-adapter loads and clears old state without a component', async () => {
    const gate = deferred()
    let signal: AbortSignal | undefined
    const initial = createDemoAccountAdapter({ wait: instant })
    const oldSnapshot = await initial.load(context())
    oldSnapshot.profile.nickname = 'Old account'
    const previous: AccountAdapter = {
      ...initial,
      load: async (request) => {
        signal = request.signal
        await gate.promise
        return oldSnapshot
      },
    }
    const next = createDemoAccountAdapter({ wait: instant })
    const current = shallowRef(previous)
    const scope = effectScope()
    const controller = scope.run(() => useAccount(() => current.value))!
    const pending = controller.load()
    current.value = next
    expect(signal?.aborted).toBe(true)
    expect(controller.snapshot.value).toBeNull()
    gate.resolve()
    await pending
    expect(controller.snapshot.value).toBeNull()
    await controller.load()
    expect(controller.snapshot.value?.profile.nickname).toBe('Nova')
    current.value = previous
    expect(controller.snapshot.value).toBeNull()
    scope.stop()
  })
})

describe('in-memory demo account adapter', () => {
  it('isolates instances and snapshots; does not include credentials in saved state', async () => {
    const a = createDemoAccountAdapter({ wait: instant }),
      b = createDemoAccountAdapter({ wait: instant })
    const snapshot = await a.load(context())
    snapshot.profile.nickname = 'changed outside'
    expect((await a.load(context())).profile.nickname).toBe('Nova')
    const changed = await a.updateProfile(
      { nickname: '<script>literal</script>', bio: 'fictional', avatar: 'teal' },
      context(),
    )
    expect(changed.profile.nickname).toBe('<script>literal</script>')
    expect((await b.load(context())).profile.nickname).toBe('Nova')
    const passwordChanged = await a.changePassword(DEMO_ACCOUNT_VALUES, context(changed.revision))
    expect(passwordChanged.security.passwordUpdatedAt).toBeTruthy()
    const text = JSON.stringify(passwordChanged)
    expect(text).not.toContain(DEMO_ACCOUNT_VALUES.currentPassword)
    expect(text).not.toContain(DEMO_ACCOUNT_VALUES.newPassword)
    expect(text).not.toContain(DEMO_ACCOUNT_VALUES.code)
  })
  it('validates Unicode lengths, control characters and notification values', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    await expect(
      adapter.updateProfile({ nickname: '😀'.repeat(24), bio: '', avatar: 'iris' }, context()),
    ).resolves.toMatchObject({ profile: { nickname: '😀'.repeat(24) } })
    await expect(
      adapter.updateProfile({ nickname: '😀'.repeat(25), bio: '', avatar: 'iris' }, context('1')),
    ).rejects.toMatchObject({ code: 'PROFILE_NICKNAME' })
    await expect(
      adapter.updateProfile({ nickname: 'bad\nname', bio: '', avatar: 'iris' }, context('1')),
    ).rejects.toMatchObject({ code: 'PROFILE_NICKNAME' })
    await expect(
      adapter.updateNotifications(
        { product: true, email: false, security: null as unknown as boolean },
        context('1'),
      ),
    ).rejects.toMatchObject({ code: 'PREFERENCES_INVALID' })
  })
  it('protects current device and retains it when all other devices are revoked', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    await expect(adapter.revokeDevice('current', context())).rejects.toMatchObject({
      code: 'CURRENT_DEVICE_PROTECTED',
    })
    const result = await adapter.revokeOtherDevices(context())
    expect(result.devices).toHaveLength(1)
    expect(result.devices[0]?.current).toBe(true)
  })
  it('rejects stale revisions without overwriting successful writes', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    await adapter.updateProfile({ nickname: 'Saved', bio: '', avatar: 'iris' }, context())
    await expect(
      adapter.updateNotifications({ product: false, email: true, security: false }, context()),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    const result = await adapter.load(context())
    expect(result.profile.nickname).toBe('Saved')
    expect(result.notifications).toEqual({ product: true, email: false, security: true })
  })
  it('checks cancellation after awaiting before committing', async () => {
    const pending = deferred(),
      controller = new AbortController()
    const adapter = createDemoAccountAdapter({ wait: () => pending.promise })
    const operation = adapter.updateProfile(
      { nickname: 'No commit', bio: '', avatar: 'iris' },
      { ...context(), signal: controller.signal },
    )
    controller.abort()
    pending.resolve()
    await expect(operation).rejects.toMatchObject({ code: 'CANCELLED' })
    expect((await adapter.load(context())).profile.nickname).toBe('Nova')
  })
  it('uses desired-state idempotence for already read messages', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    const first = await adapter.markMessageRead('new-device', context())
    const again = await adapter.markMessageRead('new-device', context())
    expect(again.revision).toBe(first.revision)
    expect(again.activity).toEqual(first.activity)
    const all = await adapter.markAllMessagesRead(context(first.revision))
    expect(all.messages.every((message) => message.read)).toBe(true)
    expect((await adapter.markAllMessagesRead(context())).revision).toBe(all.revision)
  })
  it('requires issued, matching, unexpired email code and consumes it', async () => {
    let now = 1_800_000_000_000
    const adapter = createDemoAccountAdapter({ wait: instant, now: () => now })
    await expect(adapter.changeEmail(DEMO_ACCOUNT_VALUES, context())).rejects.toMatchObject({
      code: 'EMAIL_CODE_REQUIRED',
    })
    await adapter.requestEmailChangeCode(DEMO_ACCOUNT_VALUES, context())
    await expect(
      adapter.changeEmail(
        { email: 'wrong@nova.example', code: DEMO_ACCOUNT_VALUES.code },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_REQUIRED' })
    now += 120_000
    await expect(adapter.changeEmail(DEMO_ACCOUNT_VALUES, context())).rejects.toMatchObject({
      code: 'EMAIL_CODE_EXPIRED',
    })
    await adapter.requestEmailChangeCode(DEMO_ACCOUNT_VALUES, context())
    const result = await adapter.changeEmail(DEMO_ACCOUNT_VALUES, context())
    expect(result.email).toBe(DEMO_ACCOUNT_VALUES.email)
    await expect(
      adapter.changeEmail(DEMO_ACCOUNT_VALUES, context(result.revision)),
    ).rejects.toMatchObject({ code: 'EMAIL_CODE_REQUIRED' })
  })
  it('does not issue email codes after aborted requests', async () => {
    const pending = deferred(),
      controller = new AbortController()
    const adapter = createDemoAccountAdapter({ wait: () => pending.promise })
    const operation = adapter.requestEmailChangeCode(DEMO_ACCOUNT_VALUES, {
      ...context(),
      signal: controller.signal,
    })
    controller.abort()
    pending.resolve()
    await expect(operation).rejects.toMatchObject({ code: 'CANCELLED' })
    await expect(adapter.changeEmail(DEMO_ACCOUNT_VALUES, context())).rejects.toMatchObject({
      code: 'EMAIL_CODE_REQUIRED',
    })
  })
  it('two-step state needs synthetic credentials and is idempotent', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    await expect(
      adapter.setTwoStep(
        { enabled: true, currentPassword: 'wrong', code: DEMO_ACCOUNT_VALUES.code },
        context(),
      ),
    ).rejects.toMatchObject({ code: 'DEMO_PASSWORD_ONLY' })
    const enabled = await adapter.setTwoStep({ enabled: true, ...DEMO_ACCOUNT_VALUES }, context())
    expect(enabled.security.twoStepEnabled).toBe(true)
    const again = await adapter.setTwoStep({ enabled: true, ...DEMO_ACCOUNT_VALUES }, context())
    expect(again.revision).toBe(enabled.revision)
  })
})

describe('useAccount request controller', () => {
  it('does not accept late results from adapters that ignore cancellation', async () => {
    const real = createDemoAccountAdapter({ wait: instant })
    const initial = await real.load(context())
    let resolve!: (value: typeof initial) => void
    const adapter: AccountAdapter = {
      ...real,
      load: vi.fn(
        () =>
          new Promise<typeof initial>((done) => {
            resolve = done
          }),
      ),
    }
    const controller = useAccount(adapter)
    const loading = controller.load()
    expect(controller.busy.value).toBe(true)
    controller.cancel()
    resolve(initial)
    await loading
    expect(controller.snapshot.value).toBeNull()
    expect(controller.busy.value).toBe(false)
  })
  it('checks cancellation again between request resolution and snapshot assignment', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    const snapshot = await adapter.load(context())
    const fast: AccountAdapter = { ...adapter, load: () => Promise.resolve(snapshot) }
    const controller = useAccount(fast)
    const loading = controller.load()
    queueMicrotask(() => controller.cancel())
    await loading
    expect(controller.snapshot.value).toBeNull()
    await controller.load()
    const changed = { ...snapshot, revision: '9' }
    const mutation = controller.mutate(() => Promise.resolve(changed))
    queueMicrotask(() => controller.cancel())
    await mutation
    expect(controller.snapshot.value?.revision).toBe('0')
    expect(controller.notice.value).toBe('')
  })
  it('does not report false success on failure and permits a retry', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant })
    const controller = useAccount(adapter)
    await controller.load()
    await controller.mutate(() => Promise.reject(new Error('Rejected')))
    expect(controller.error.value).toBe('Rejected')
    expect(controller.notice.value).toBe('')
    expect(controller.snapshot.value?.revision).toBe('0')
    await controller.mutate((ctx) => adapter.markAllMessagesRead(ctx))
    expect(controller.error.value).toBe('')
    expect(controller.unread.value).toBe(0)
  })
  it('deduplicates double submissions while busy and includes current revision', async () => {
    const adapter = createDemoAccountAdapter({ wait: instant }),
      controller = useAccount(adapter)
    await controller.load()
    const pending = deferred(),
      contexts: RequestContext[] = []
    const operation = vi.fn(async (ctx: MutationContext) => {
      contexts.push(ctx)
      await pending.promise
      return adapter.markAllMessagesRead(ctx)
    })
    const first = controller.mutate(operation)
    const second = controller.mutate(operation)
    pending.resolve()
    await Promise.all([first, second])
    expect(operation).toHaveBeenCalledTimes(1)
    expect(contexts[0]?.requestId).toBeTruthy()
    expect(controller.snapshot.value?.revision).toBe('1')
  })
})

describe('explicit public request outcomes', () => {
  it('distinguishes busy and cancellation without invoking a duplicate operation', async () => {
    const controller = useAccount(createDemoAccountAdapter({ wait: instant }))
    const gate = deferred()
    const operation = vi.fn(async () => {
      await gate.promise
      return 42
    })
    const pending = controller.requestResult(operation)
    expect(await controller.requestResult(operation)).toEqual({ status: 'busy' })
    expect(operation).toHaveBeenCalledTimes(1)
    controller.cancel()
    gate.resolve()
    expect(await pending).toEqual({ status: 'cancelled' })
    expect(controller.error.value).toBe('')
    expect(await controller.requestResult(async () => undefined)).toEqual({
      status: 'success',
      value: undefined,
    })
  })
  it('returns the original failure and supports a subsequent success', async () => {
    const controller = useAccount(createDemoAccountAdapter({ wait: instant }))
    const failure = new Error('Service unavailable')
    expect(await controller.requestResult(() => Promise.reject(failure))).toEqual({
      status: 'error',
      error: failure,
    })
    expect(controller.error.value).toBe('Service unavailable')
    expect(await controller.requestResult(async () => 7)).toEqual({ status: 'success', value: 7 })
    expect(controller.error.value).toBe('')
  })
})
