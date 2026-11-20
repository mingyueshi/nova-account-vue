import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createDemoAccountAdapter, createInitialAccount } from '../demo/account'
import NovaMfaSetup from '../src/components/NovaMfaSetup.vue'
import NovaRecoveryCodes from '../src/components/NovaRecoveryCodes.vue'
import type { MfaSetupAdapter, TotpEnrollment } from '../src/types'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function enrollment(): TotpEnrollment {
  return { id: 'binding', manualKey: 'EXAMPLEKEY', expiresAt: Date.now() + 60_000, digits: 8 }
}
function fixture() {
  const mfa = {
    beginTotp: vi.fn<MfaSetupAdapter['beginTotp']>().mockResolvedValue(enrollment()),
    confirmTotp: vi
      .fn<MfaSetupAdapter['confirmTotp']>()
      .mockResolvedValue({ recoveryCodes: ['code-one', 'code-two'] }),
  }
  const snapshot = createInitialAccount(Date.now())
  const adapter = { ...createDemoAccountAdapter(), mfa }
  const wrapper = mount(NovaMfaSetup, { props: { adapter, snapshot } })
  const begin = async () => {
    await wrapper.get('button').trigger('click')
    await flushPromises()
  }
  const submit = async (code: string) => {
    await wrapper.get('input').setValue(code)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
  }
  return { mfa, snapshot, adapter, wrapper, begin, submit }
}

describe('TOTP setup', () => {
  it('validates the host digit count, retries rejected codes, and retains issued codes across the enrolled refresh', async () => {
    const { mfa, snapshot, wrapper, begin, submit } = fixture()
    expect(mfa.beginTotp).not.toHaveBeenCalled()
    await begin()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('EXAMPLEKEY')
    await submit('123456')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(mfa.confirmTotp).not.toHaveBeenCalled()
    mfa.confirmTotp.mockRejectedValueOnce(new Error('Invalid code'))
    await submit('00001234')
    expect(wrapper.get('[role="alert"]').text()).toBe('Invalid code')
    await wrapper.setProps({ snapshot: { ...snapshot, revision: '2' } })
    await submit('00123456')
    expect(mfa.confirmTotp).toHaveBeenLastCalledWith(
      { enrollmentId: 'binding', code: '00123456' },
      expect.objectContaining({ revision: '2' }),
    )
    expect(wrapper.emitted('enrolled')).toEqual([[]])
    await wrapper.setProps({
      snapshot: { ...snapshot, revision: '3', security: { twoStepEnabled: true } },
    })
    expect(wrapper.text()).not.toContain('EXAMPLEKEY')
    expect(wrapper.get('li').text()).toBe('code-one')
    await wrapper.getComponent(NovaRecoveryCodes).findAll('button')[2].trigger('click')
    expect(wrapper.text()).not.toContain('code-one')
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.setProps({ snapshot })
    expect(wrapper.get('button').text()).toBe('设置身份验证器')
  })

  it('keeps the confirmation response when another refresh already sees two-step enabled', async () => {
    const { mfa, snapshot, wrapper, begin, submit } = fixture()
    let finish!: (data: { recoveryCodes: string[] }) => void
    mfa.confirmTotp.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await begin()
    await submit('00001234')
    await wrapper.setProps({
      snapshot: { ...snapshot, revision: '1', security: { twoStepEnabled: true } },
    })
    finish({ recoveryCodes: ['single-issuance'] })
    await flushPromises()
    expect(wrapper.get('li').text()).toBe('single-issuance')
  })

  it('expires displayed keys, rejects invalid QR material and allows restarting', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const { wrapper, mfa, begin } = fixture()
    mfa.beginTotp.mockResolvedValueOnce({
      ...enrollment(),
      qrCodeDataUrl: 'https://example.test/qr',
    })
    await begin()
    expect(wrapper.get('[role="alert"]').text()).toContain('资料无效')
    expect(wrapper.find('img').exists()).toBe(false)
    await begin()
    await vi.advanceTimersByTimeAsync(60_001)
    expect(wrapper.text()).not.toContain('EXAMPLEKEY')
    expect(wrapper.get('[role="alert"]').text()).toContain('已过期')
    mfa.beginTotp.mockResolvedValueOnce(enrollment())
    await begin()
    await wrapper.get('form button[type="button"]').trigger('click')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('EXAMPLEKEY')
  })

  it('discards cancelled issuance and confirmation results after an account switch', async () => {
    const { mfa, wrapper, begin, submit, snapshot, adapter } = fixture()
    let issue!: (data: TotpEnrollment) => void
    mfa.beginTotp.mockReturnValueOnce(
      new Promise((resolve) => {
        issue = resolve
      }),
    )
    await begin()
    await wrapper.findAll('button')[1].trigger('click')
    expect(mfa.beginTotp.mock.calls[0][0].signal.aborted).toBe(true)
    issue(enrollment())
    await flushPromises()
    expect(wrapper.find('input').exists()).toBe(false)
    await begin()
    let finish!: (data: { recoveryCodes: string[] }) => void
    mfa.confirmTotp.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await submit('12345678')
    await wrapper.setProps({
      snapshot: { ...snapshot, profile: { ...snapshot.profile, id: 'another' } },
    })
    expect(mfa.confirmTotp.mock.calls[0][1].signal.aborted).toBe(true)
    finish({ recoveryCodes: ['old-account-code'] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('old-account-code')
    expect(wrapper.emitted('enrolled')).toBeUndefined()
    await wrapper.setProps({ adapter: { ...adapter, mfa: undefined } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('surfaces malformed confirmation responses without reporting success', async () => {
    const { mfa, wrapper, begin, submit } = fixture()
    mfa.confirmTotp.mockResolvedValueOnce({ recoveryCodes: [null as unknown as string] })
    await begin()
    await submit('00123456')
    expect(wrapper.find('code').exists()).toBe(false)
    expect(wrapper.emitted('enrolled')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('刷新账户状态')
  })
})

describe('one-time recovery codes', () => {
  it('keeps the codes after copy or failure, then hides them on explicit acknowledgment', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(NovaRecoveryCodes, { props: { codes: ['first', 'second'] } })
    await flushPromises()
    const [copy, , saved] = wrapper.findAll('button')
    await copy.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('手动保存')
    await copy.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith('first\nsecond')
    expect(wrapper.get('[role="status"]').text()).toContain('已复制')
    expect(wrapper.findAll('li')).toHaveLength(2)
    await saved.trigger('click')
    expect(wrapper.emitted('acknowledged')).toEqual([[]])
    await wrapper.setProps({ codes: ['first', 'second'] })
    expect(wrapper.text()).not.toContain('first')
  })
})
