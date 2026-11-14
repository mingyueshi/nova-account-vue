import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import NovaAuthForm from '../src/components/NovaAuthForm.vue'
import NovaCaptcha from '../src/components/NovaCaptcha.vue'
import type { AuthAdapter } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
function adapter(kind: 'slider' | 'custom' = 'slider'): AuthAdapter {
  return {
    challenge: vi.fn(async () => ({ id: 'challenge', kind, expiresAt: Date.now() + 100_000 })),
    verifyCaptcha: vi.fn(async () => ({ token: 'proof', expiresAt: Date.now() + 100_000 })),
    sendCode: vi.fn(async () => ({
      expiresAt: Date.now() + 100_000,
      retryAfter: 30,
      demoCode: '123456',
    })),
    login: vi.fn(async () => ({
      user: { id: 'user', email: 'person@example.test', displayName: 'Person' },
    })),
    register: vi.fn(async () => ({
      user: { id: 'user', email: 'person@example.test', displayName: 'Person' },
    })),
    verifyResetCode: vi.fn(async () => ({ token: 'reset', expiresAt: Date.now() + 100_000 })),
    resetPassword: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  }
}

describe('authentication components', () => {
  it('only submits completed pointer input and resets the slider for a new challenge', async () => {
    const wrapper = mount(NovaCaptcha, {
      props: { challenge: { id: 'pointer', kind: 'slider', expiresAt: Date.now() + 100_000 } },
    })
    wrappers.push(wrapper)
    const slider = wrapper.get('input[type="range"]')
    await slider.setValue(40)
    await slider.trigger('pointerup')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await slider.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
    await slider.setValue(100)
    await slider.trigger('pointerup')
    expect(wrapper.emitted('submit')).toEqual([[{ value: 100 }]])
    await wrapper.setProps({
      challenge: { id: 'replacement', kind: 'slider', expiresAt: Date.now() + 100_000 },
    })
    expect(slider.element).toHaveProperty('value', '0')
    expect(wrapper.get('[role="alert"]').text()).toBe('')
  })

  it('blocks verification and retry while busy, moves focus to status, then allows explicit retry', async () => {
    const wrapper = mount(NovaCaptcha, {
      attachTo: document.body,
      props: {
        challenge: { id: 'busy', kind: 'slider', expiresAt: Date.now() + 100_000 },
        simulated: true,
      },
    })
    wrappers.push(wrapper)
    const slider = wrapper.get('input[type="range"]')
    expect(document.activeElement).toBe(slider.element)
    await slider.setValue(100)
    await wrapper.setProps({ busy: true, error: 'Verification failed' })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[role="status"]').element)
    await slider.trigger('keydown', { key: 'Enter' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('retry')).toBeUndefined()
    await wrapper.setProps({ busy: false })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toContain('仅模拟交互')
    await wrapper.setProps({ simulated: false })
    expect(wrapper.get('[role="status"]').text()).not.toContain('仅模拟交互')
  })

  it('keeps password visibility and single-login keyboard navigation local to the form', async () => {
    const service = adapter()
    const wrapper = mount(NovaAuthForm, { props: { adapter: service, modes: ['password'] } })
    wrappers.push(wrapper)
    wrapper.vm.fill({ password: 'Secret draft' })
    await flushPromises()
    const toggle = () =>
      wrapper.findAll('button').find((item) => /显示密码|隐藏密码/.test(item.text()))!
    await toggle().trigger('click')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('type')).toBe('text')
    await toggle().trigger('click')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('type')).toBe(
      'password',
    )
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(service.challenge).not.toHaveBeenCalled()
  })

  it('focuses the first invalid field, then the global error when the adapter rejects submission', async () => {
    const service = adapter()
    service.login = vi.fn(async () => {
      throw new Error('Service unavailable. Try again.')
    })
    const wrapper = mount(NovaAuthForm, {
      attachTo: document.body,
      props: { adapter: service },
    })
    wrappers.push(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('input[type="email"]').element)

    wrapper.vm.setMode('code')
    wrapper.vm.fill({ email: 'person@example.test' })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '获取验证码')!
      .trigger('click')
    await flushPromises()
    const slider = wrapper.get('input[type="range"]')
    await slider.setValue(100)
    await slider.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    wrapper.vm.fill({ code: '123456' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const error = wrapper.get('form [role="alert"]')
    expect(error.text()).toBe('Service unavailable. Try again.')
    expect(document.activeElement).toBe(error.element)
    expect(wrapper.emitted('authenticated')).toBeUndefined()
    expect(service.login).toHaveBeenCalledTimes(1)
  })

  it('renders a real Vue form without a permanently visible captcha', async () => {
    const service = adapter(),
      wrapper = mount(NovaAuthForm, { props: { adapter: service, simulated: true } })
    wrappers.push(wrapper)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('欢迎回来')
    wrapper.vm.fill({ email: 'person@example.test', password: 'password' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('input[type="range"]').exists()).toBe(true)
    expect(service.login).not.toHaveBeenCalled()
    await wrapper.find('input[type="range"]').setValue(100)
    await wrapper.find('input[type="range"]').trigger('keydown', { key: 'End' })
    expect(service.verifyCaptcha).not.toHaveBeenCalled()
    await wrapper.find('input[type="range"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(service.login).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('authenticated')).toHaveLength(1)
  })

  it('does not substitute a basic slider for an unsupported custom challenge', async () => {
    const service = adapter('custom'),
      wrapper = mount(NovaAuthForm, { props: { adapter: service } })
    wrappers.push(wrapper)
    wrapper.vm.fill({ email: 'person@example.test', password: 'password' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('专用验证组件')
    expect(service.verifyCaptcha).not.toHaveBeenCalled()
  })

  it('supports a host-provided custom captcha slot', async () => {
    const service = adapter('custom'),
      wrapper = mount(NovaAuthForm, {
        props: { adapter: service },
        slots: {
          captcha:
            '<button data-custom @click="params.submit({ signedResponse: \'opaque\' })">Custom challenge {{ params.challenge.id }}</button>',
        },
      })
    wrappers.push(wrapper)
    wrapper.vm.fill({ email: 'person@example.test', password: 'password' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Custom challenge challenge')
    await wrapper.find('[data-custom]').trigger('click')
    await flushPromises()
    expect(service.verifyCaptcha).toHaveBeenCalledWith(
      expect.objectContaining({ response: { signedResponse: 'opaque' } }),
      expect.anything(),
    )
  })

  it('renders labels and adapter error strings as text, never HTML', async () => {
    const wrapper = mount(NovaCaptcha, {
      props: {
        challenge: {
          id: 'label-test',
          kind: 'slider',
          expiresAt: Date.now() + 100_000,
          label: '<img src=x onerror=alert(1)>',
        },
        error: '<script>bad()</script>',
      },
    })
    wrappers.push(wrapper)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('requires explicit keyboard confirmation and refuses incomplete slider values', async () => {
    const wrapper = mount(NovaCaptcha, {
      props: { challenge: { id: 'keyboard', kind: 'slider', expiresAt: Date.now() + 100_000 } },
    })
    wrappers.push(wrapper)
    const slider = wrapper.find('input[type="range"]')
    await slider.setValue(50)
    await slider.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('移动到最右侧')
    await slider.setValue(100)
    await slider.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await slider.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([[{ value: 100 }]])
  })

  it('supports arrow-key tab navigation without submitting', async () => {
    const service = adapter(),
      wrapper = mount(NovaAuthForm, { props: { adapter: service } })
    wrappers.push(wrapper)
    await wrapper.find('[role="tab"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')
    expect(wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(true)
    expect(service.challenge).not.toHaveBeenCalled()
  })

  it('uses an allowed initial mode and never switches to a disabled flow', async () => {
    const wrapper = mount(NovaAuthForm, {
      props: { adapter: adapter(), modes: ['code', 'register'] },
    })
    wrappers.push(wrapper)
    expect(wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(false)
    const labelId = wrapper.get('form').attributes('aria-labelledby')
    expect(wrapper.find(`[id="${labelId}"]`).exists()).toBe(true)
    wrapper.vm.setMode('password')
    await flushPromises()
    expect(wrapper.emitted('mode-change')).toBeUndefined()
    wrapper.vm.setMode('register')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '← 返回登录')!
      .trigger('click')
    expect(wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(false)
  })

  it('removes disabled active flows and cancels pending results when modes change', async () => {
    const service = adapter()
    let resolve!: (value: Awaited<ReturnType<AuthAdapter['challenge']>>) => void
    service.challenge = vi.fn<AuthAdapter['challenge']>(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = mount(NovaAuthForm, { props: { adapter: service } })
    wrappers.push(wrapper)
    wrapper.vm.fill({ email: 'person@example.test', password: 'secret' })
    void wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.setProps({ modes: ['code'] })
    expect(vi.mocked(service.challenge).mock.calls[0]![1].signal.aborted).toBe(true)
    resolve({ id: 'late', kind: 'slider', expiresAt: Date.now() + 100_000 })
    await flushPromises()
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="one-time-code"]').exists()).toBe(true)
    await wrapper.setProps({ modes: [] })
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.vm.setMode('password')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(service.login).not.toHaveBeenCalled()
  })

  it('uses absolute Home and End tab navigation', async () => {
    const wrapper = mount(NovaAuthForm, { props: { adapter: adapter() } })
    wrappers.push(wrapper)
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[0]!.trigger('keydown', { key: 'Home' })
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    await tabs[0]!.trigger('keydown', { key: 'End' })
    await tabs[1]!.trigger('keydown', { key: 'End' })
    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
    await tabs[1]!.trigger('keydown', { key: 'Home' })
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
  })

  it('updates identifier validation when the host changes its prop', async () => {
    const service = adapter()
    const wrapper = mount(NovaAuthForm, { props: { adapter: service, modes: ['password'] } })
    wrappers.push(wrapper)
    await wrapper.setProps({ identifier: 'username' })
    wrapper.vm.fill({ email: 'AdminUser', password: 'secret' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(service.challenge).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'AdminUser' }),
      expect.anything(),
    )
    await wrapper.setProps({ identifier: 'email' })
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    wrapper.vm.fill({ password: 'secret' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('input[type="email"]').attributes('aria-invalid')).toBe('true')
    expect(service.challenge).toHaveBeenCalledTimes(1)
  })
})
