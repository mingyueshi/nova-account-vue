import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import NovaAccount from '../src/components/NovaAccount.vue'
import { createDemoAuthAdapter, demoUser } from '../demo/auth'
import { createDemoAccountAdapter } from '../demo/account'
import type { NovaAdapter, RequestContext } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
function adapter(logout = vi.fn(async (_: RequestContext) => {})): NovaAdapter {
  return {
    simulated: true,
    auth: { ...createDemoAuthAdapter({ delay: () => Promise.resolve() }), logout },
    account: createDemoAccountAdapter({ wait: () => Promise.resolve() }),
  }
}
async function create(service: NovaAdapter) {
  const wrapper = mount(NovaAccount, {
    props: { adapter: service, initialUser: demoUser(), locale: 'en-US' },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('account shell session lifecycle', () => {
  it('keeps the account visible on logout failure and retries only on user action', async () => {
    const logout = vi
      .fn()
      .mockRejectedValueOnce(new Error('Host service unavailable'))
      .mockResolvedValueOnce(undefined)
    const wrapper = await create(adapter(logout))
    const signOut = () => wrapper.findAll('button').find((item) => item.text() === '↗ Sign out')!
    await signOut().trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Overview')
    expect(wrapper.get('[role="alert"]').text()).toContain('Host service unavailable')
    expect(wrapper.emitted('logout')).toBeUndefined()
    await signOut().trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Welcome back')
    expect(wrapper.emitted('logout')).toHaveLength(1)
    expect(logout).toHaveBeenCalledTimes(2)
  })

  it('deduplicates logout and rejects a late completion after adapter replacement', async () => {
    let finish!: () => void
    let signal!: AbortSignal
    const logout = vi.fn(async (context: RequestContext) => {
      signal = context.signal
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const wrapper = await create(adapter(logout))
    const signOut = wrapper.findAll('button').find((item) => item.text() === '↗ Sign out')!
    await signOut.trigger('click')
    await signOut.trigger('click')
    expect(wrapper.text()).toContain('Signing out…')
    expect(logout).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ adapter: adapter() })
    expect(signal.aborted).toBe(true)
    finish()
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Welcome back')
    expect(wrapper.emitted('logout')).toBeUndefined()
  })

  it('uses localized fallback errors and aborts pending logout on unmount', async () => {
    const wrapper = await create(
      adapter(
        vi.fn(async () => {
          throw 'unstructured failure'
        }),
      ),
    )
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '↗ Sign out')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Sign-out failed. Try again.')
    let signal!: AbortSignal
    const service = adapter(
      vi.fn(async (context) => {
        signal = context.signal
        await new Promise(() => {})
      }),
    )
    await wrapper.setProps({ adapter: service })
    wrapper.vm.preview(demoUser())
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '↗ Sign out')!
      .trigger('click')
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(signal.aborted).toBe(true)
  })

  it('authenticates through the shell and prevents production preview bypass', async () => {
    const service = adapter()
    const wrapper = mount(NovaAccount, { props: { adapter: service }, attachTo: document.body })
    wrappers.push(wrapper)
    wrapper.vm.fill({ email: 'demo@nova.example', password: 'NovaDemo2026!' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const slider = wrapper.get('input[type="range"]')
    await slider.setValue(100)
    await slider.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.emitted('authenticated')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('账户概览')
    await wrapper.setProps({ adapter: { ...adapter(), simulated: false } })
    wrapper.vm.preview(demoUser())
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('欢迎回来')
  })
})
