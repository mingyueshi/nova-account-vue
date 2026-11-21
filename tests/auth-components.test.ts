import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import NovaAuthForm from '../src/components/NovaAuthForm.vue'
import NovaCaptcha from '../src/components/NovaCaptcha.vue'
import type { AuthAdapter } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function pointerEvent(element: Element, type: string, options: PointerEventInit) {
  element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...options }))
  await flushPromises()
}
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
    vi.spyOn(slider.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 248,
    } as DOMRect)
    Object.defineProperty(slider.element, 'setPointerCapture', { value: vi.fn() })
    const pointer = { pointerId: 1, button: 0, isPrimary: true }
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 24 })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 104 })
    expect(wrapper.get('.nova-captcha-prompt').isVisible()).toBe(false)
    await pointerEvent(slider.element, 'pointerup', { ...pointer, clientX: 104 })
    expect((slider.element as HTMLInputElement).valueAsNumber).toBe(40)
    expect(wrapper.emitted('submit')).toBeUndefined()
    await slider.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 104 })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await pointerEvent(slider.element, 'pointerup', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toEqual([[{ value: 100 }]])
    await wrapper.setProps({
      challenge: { id: 'replacement', kind: 'slider', expiresAt: Date.now() + 100_000 },
    })
    expect(slider.element).toHaveProperty('value', '0')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('ignores track jumps and secondary pointers, and never submits a cancelled drag', async () => {
    const wrapper = mount(NovaCaptcha, {
      props: { challenge: { id: 'cancel', kind: 'slider', expiresAt: Date.now() + 100_000 } },
    })
    wrappers.push(wrapper)
    const slider = wrapper.get('input[type="range"]')
    vi.spyOn(slider.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 248,
    } as DOMRect)
    const pointer = { pointerId: 1, button: 0, isPrimary: true }
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 240 })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 240 })
    await pointerEvent(slider.element, 'pointerup', { ...pointer, clientX: 240 })
    expect(slider.element).toHaveProperty('value', '0')
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, button: 2 })
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, isPrimary: false })
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 24 })
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, pointerId: 2, clientX: 24 })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, pointerId: 2, clientX: 224 })
    await pointerEvent(slider.element, 'pointerup', { ...pointer, pointerId: 2, clientX: 224 })
    expect(slider.element).toHaveProperty('value', '0')
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 224 })
    await pointerEvent(slider.element, 'pointercancel', pointer)
    await pointerEvent(slider.element, 'pointerup', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.setProps({ busy: true })
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 224 })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it.each([
    { button: 2, isPrimary: true },
    { button: 1, isPrimary: true },
    { button: 0, isPrimary: false },
  ])('ends the drag without submitting on release with %o', async (release) => {
    const wrapper = mount(NovaCaptcha, {
      props: { challenge: { id: 'release', kind: 'slider', expiresAt: Date.now() + 100_000 } },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input').element
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 248 } as DOMRect)
    const pointer = { pointerId: 1, isPrimary: true, button: 0 }
    await pointerEvent(input, 'pointerdown', { ...pointer, clientX: 24 })
    await pointerEvent(input, 'pointermove', { ...pointer, clientX: 224 })
    await pointerEvent(input, 'pointerup', { ...pointer, ...release, clientX: 224 })
    await pointerEvent(input, 'pointerup', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toBeUndefined()

    await pointerEvent(input, 'pointerdown', { ...pointer, clientX: 224 })
    await pointerEvent(input, 'pointerup', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toEqual([[{ value: 100 }]])
  })

  it('invalidates an in-flight drag when the challenge is replaced or becomes busy', async () => {
    const wrapper = mount(NovaCaptcha, {
      props: { challenge: { id: 'first', kind: 'slider', expiresAt: Date.now() + 100_000 } },
    })
    wrappers.push(wrapper)
    const slider = wrapper.get('input[type="range"]')
    vi.spyOn(slider.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 248,
    } as DOMRect)
    const pointer = { pointerId: 1, button: 0, isPrimary: true, pointerType: 'touch' }
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 24 })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 104 })
    await wrapper.setProps({
      challenge: { id: 'next', kind: 'slider', expiresAt: Date.now() + 100_000 },
    })
    await pointerEvent(slider.element, 'pointermove', { ...pointer, clientX: 224 })
    await pointerEvent(slider.element, 'pointerup', { ...pointer, clientX: 224 })
    expect(slider.element).toHaveProperty('value', '0')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await pointerEvent(slider.element, 'pointerdown', { ...pointer, clientX: 24 })
    await wrapper.setProps({ busy: true })
    await pointerEvent(slider.element, 'pointerup', { ...pointer, clientX: 224 })
    expect(wrapper.emitted('submit')).toBeUndefined()
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
    expect(wrapper.get('.nova-captcha-prompt').isVisible()).toBe(true)
    await slider.trigger('keydown', { key: 'Enter' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('retry')).toBeUndefined()
    await wrapper.setProps({ busy: false })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await wrapper.setProps({ simulated: false })
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  it('keeps password visibility and single-login keyboard navigation local to the form', async () => {
    const service = adapter()
    const wrapper = mount(NovaAuthForm, { props: { adapter: service, modes: ['password'] } })
    wrappers.push(wrapper)
    wrapper.vm.fill({ password: 'Secret draft' })
    await flushPromises()
    const toggle = () =>
      wrapper
        .findAll('button')
        .find((item) => /显示密码|隐藏密码/.test(item.attributes('aria-label') ?? ''))!
    await toggle().trigger('click')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('type')).toBe('text')
    await toggle().trigger('click')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('type')).toBe(
      'password',
    )
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(service.challenge).not.toHaveBeenCalled()
  })

  it('advances through credential inputs without submitting or interrupting composition', async () => {
    const service = adapter()
    const wrapper = mount(NovaAuthForm, { attachTo: document.body, props: { adapter: service } })
    wrappers.push(wrapper)
    wrapper.vm.setMode('register')
    await flushPromises()
    const email = wrapper.get('input[type="email"]')
    const password = wrapper.get('input[autocomplete="new-password"]')
    const code = wrapper.get('input[autocomplete="one-time-code"]')
    expect(email.attributes()).toMatchObject({
      autocapitalize: 'none',
      spellcheck: 'false',
      inputmode: 'email',
      enterkeyhint: 'next',
    })
    ;(email.element as HTMLInputElement).focus()
    await email.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(document.activeElement).toBe(email.element)
    await email.trigger('keydown', { key: 'Enter' })
    expect(document.activeElement).toBe(password.element)
    await password.trigger('keydown', { key: 'Enter' })
    expect(document.activeElement).toBe(code.element)
    expect(service.challenge).not.toHaveBeenCalled()
    expect(wrapper.find('form [role="alert"]').exists()).toBe(false)
    wrapper.vm.setMode('password')
    await flushPromises()
    const final = wrapper.get('input[autocomplete="current-password"]')
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    final.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('returns focus to the explicit code trigger on cancellation and announces delivery once', async () => {
    const wrapper = mount(NovaAuthForm, { attachTo: document.body, props: { adapter: adapter() } })
    wrappers.push(wrapper)
    wrapper.vm.setMode('code')
    wrapper.vm.fill({ email: 'person@example.test' })
    await flushPromises()
    const trigger = wrapper.get('[data-request-code]')
    await trigger.trigger('click')
    await flushPromises()
    await wrapper.get('[aria-label="关闭对话框"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(trigger.element)
    await trigger.trigger('click')
    await flushPromises()
    const slider = wrapper.get('input[type="range"]')
    await slider.setValue(100)
    await slider.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(
      wrapper
        .findAll('form [role="status"]')
        .filter((node) => node.text().includes('验证码已发出')),
    ).toHaveLength(1)
    expect(document.activeElement).toBe(wrapper.get('input[autocomplete="one-time-code"]').element)
    expect(trigger.attributes('disabled')).toBeDefined()
  })

  it('completes password recovery with retained identity, confirmation feedback and safe focus', async () => {
    const host = document.createElement('main')
    host.setAttribute('data-auth-content', '')
    document.body.append(host)
    const service = adapter()
    const wrapper = mount(NovaAuthForm, { attachTo: host, props: { adapter: service } })
    wrappers.push(wrapper)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '忘记密码？')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('input[type="email"]').setValue('person@example.test')
    await wrapper.get('[data-request-code]').trigger('click')
    await flushPromises()
    const slider = wrapper.get('input[type="range"]')
    await slider.setValue(100)
    await slider.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await wrapper.get('input[autocomplete="one-time-code"]').setValue('123456')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const password = wrapper.findAll('input[autocomplete="new-password"]')[0]!
    const confirm = wrapper.findAll('input[autocomplete="new-password"]')[1]!
    expect(document.activeElement).toBe(password.element)
    await password.setValue('new-password')
    await confirm.setValue('different')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(document.activeElement).toBe(confirm.element)
    await confirm.setValue('new-password')
    expect(wrapper.find('form [role="alert"]').exists()).toBe(false)
    await wrapper.get('[aria-label="显示密码"]').trigger('pointerdown')
    await wrapper.get('[aria-label="显示密码"]').trigger('click')
    expect(confirm.attributes('type')).toBe('text')
    host.scrollTop = 100
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.get('input[type="email"]').element).toHaveProperty(
      'value',
      'person@example.test',
    )
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('type')).toBe(
      'password',
    )
    expect(wrapper.get('form [role="status"]').text()).toContain('密码已重置')
    expect(document.activeElement).toBe(wrapper.get('form [role="status"]').element)
    expect(host.scrollTop).toBe(0)
    host.remove()
  })

  it('keeps registration consent actionable and identifies expired codes before resending', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    try {
      const wrapper = mount(NovaAuthForm, {
        attachTo: document.body,
        props: { adapter: adapter(), simulated: true },
      })
      wrappers.push(wrapper)
      wrapper.vm.setMode('register')
      wrapper.vm.fill({ email: 'person@example.test', password: 'secret' })
      await flushPromises()
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      const consent = wrapper.get('input[type="checkbox"]')
      expect(consent.attributes('aria-describedby')).toBeDefined()
      await consent.setValue(true)
      expect(consent.attributes('aria-describedby')).toBeUndefined()
      expect(wrapper.find('form [role="alert"]').exists()).toBe(false)
      await wrapper.get('[data-request-code]').trigger('click')
      await flushPromises()
      const slider = wrapper.get('input[type="range"]')
      await slider.setValue(100)
      await slider.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(wrapper.text()).toContain('演示码 123456')
      vi.advanceTimersByTime(101_000)
      await flushPromises()
      expect(wrapper.get('form span[role="status"]').text()).toContain('已过期')
      expect(wrapper.get('[data-request-code]').attributes('disabled')).toBeUndefined()
      expect(wrapper.get('[data-request-code]').text()).toBe('重新获取')
    } finally {
      vi.useRealTimers()
    }
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

  it('returns focus and retained credentials to the login form after a password rejection', async () => {
    const service = adapter()
    service.login = vi
      .fn<AuthAdapter['login']>()
      .mockRejectedValueOnce(new Error('Incorrect password'))
    const wrapper = mount(NovaAuthForm, {
      attachTo: document.body,
      props: { adapter: service },
    })
    wrappers.push(wrapper)
    wrapper.vm.fill({ email: 'person@example.test', password: 'wrong-password' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const slider = wrapper.get('input[type="range"]')
    await slider.setValue(100)
    await slider.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    const error = wrapper.get('form [role="alert"]')
    expect(error.text()).toBe('Incorrect password')
    expect(document.activeElement).toBe(error.element)
    expect(wrapper.get<HTMLInputElement>('input[type="email"]').element.value).toBe(
      'person@example.test',
    )
    expect(
      wrapper.get<HTMLInputElement>('input[autocomplete="current-password"]').element.value,
    ).toBe('wrong-password')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('authenticated')).toBeUndefined()

    service.login = adapter().login
    await wrapper.get('input[autocomplete="current-password"]').setValue('corrected-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('form [role="alert"]').exists()).toBe(false)
    expect(service.challenge).toHaveBeenCalledTimes(2)
    const retrySlider = wrapper.get('input[type="range"]')
    await retrySlider.setValue(100)
    await retrySlider.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(service.verifyCaptcha).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('authenticated')).toHaveLength(1)
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
