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
})
