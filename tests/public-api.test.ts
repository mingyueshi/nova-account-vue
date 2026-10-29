import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import NovaAccountCenter from '../src/components/NovaAccountCenter.vue'
import NovaAccount from '../src/components/NovaAccount.vue'
import NovaField from '../src/components/NovaField.vue'
import NovaAuthForm from '../src/components/NovaAuthForm.vue'
import { createDemoAccountAdapter } from '../demo/account'
import { createDemoAuthAdapter, demoUser } from '../demo/auth'
import type { AccountPage, NovaAdapter } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
function adapter(): NovaAdapter {
  return {
    auth: createDemoAuthAdapter(),
    account: createDemoAccountAdapter({ wait: () => Promise.resolve() }),
  }
}

describe('controlled account pages', () => {
  it('requests a controlled page without committing until the parent accepts it', async () => {
    const wrapper = mount(NovaAccountCenter, {
      props: { adapter: adapter().account, page: 'messages' },
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('消息中心')
    await wrapper.get('[data-page="devices"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([['devices']])
    expect(wrapper.get('h1').text()).toBe('消息中心')
    expect(wrapper.emitted('pageChange')).toBeUndefined()
    await wrapper.setProps({ page: 'devices' })
    expect(wrapper.get('h1').text()).toBe('登录设备')
    expect(wrapper.emitted('pageChange')).toEqual([['devices']])
    expect(wrapper.emitted('update:page')).toHaveLength(1)
  })

  it('guards dirty navigation in a real parent v-model and resets discarded drafts', async () => {
    const page = ref<AccountPage>('profile')
    const service = adapter().account
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(NovaAccountCenter, {
            adapter: service,
            page: page.value,
            'onUpdate:page': (value) => {
              page.value = value
            },
          }),
      }),
    )
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('input[autocomplete="nickname"]').setValue('Unsaved')
    await wrapper.get('[data-page="devices"]').trigger('click')
    expect(page.value).toBe('profile')
    const leave = wrapper.findAll('button').find((button) => button.text() === '放弃并离开')!
    await leave.trigger('click')
    expect(page.value).toBe('devices')
    await wrapper.get('[data-page="profile"]').trigger('click')
    expect((wrapper.get('input[autocomplete="nickname"]').element as HTMLInputElement).value).toBe(
      'Nova',
    )
  })

  it('supports an initial uncontrolled page and forwards shell page updates', async () => {
    const wrapper = mount(NovaAccount, {
      props: {
        adapter: adapter(),
        initialUser: demoUser(),
        initialPage: 'devices',
        layout: 'embedded',
        locale: 'en-US',
      },
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Devices')
    expect(wrapper.get('[data-layout]').attributes('data-layout')).toBe('embedded')
    expect(wrapper.get('[data-layout]').classes()).not.toContain('na:h-dvh')
    await wrapper.get('[data-page="messages"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([['messages']])
    expect(wrapper.emitted('pageChange')).toEqual([['messages']])
  })
})

describe('field and auth presentation extensions', () => {
  it('preserves labels, description, attrs and affixes for a bounded textarea', async () => {
    const wrapper = mount(NovaField, {
      props: { modelValue: '', label: 'Bio', as: 'textarea', maxlength: 120, hint: 'About you' },
      attrs: { rows: 4 },
      slots: { prefix: '<span>Before</span>', suffix: '<span>After</span>' },
    })
    wrappers.push(wrapper)
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes()).toMatchObject({ maxlength: '120', rows: '4' })
    expect(wrapper.get('label').attributes('for')).toBe(textarea.attributes('id'))
    expect(wrapper.get(`#${textarea.attributes('aria-describedby')}`).text()).toBe('About you')
    expect(wrapper.text()).toContain('Before')
    expect(wrapper.text()).toContain('After')
    await textarea.setValue('Draft')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Draft']])
  })

  it('bounds codes by default and permits a different server code length', async () => {
    const wrapper = mount(NovaAuthForm, { props: { adapter: adapter().auth, codeLength: 8 } })
    wrappers.push(wrapper)
    wrapper.vm.setMode('code')
    await flushPromises()
    expect(wrapper.get('[autocomplete="one-time-code"]').attributes('maxlength')).toBe('8')
    await wrapper.setProps({ codeLength: null })
    expect(wrapper.get('[autocomplete="one-time-code"]').attributes('maxlength')).toBeUndefined()
    await wrapper.setProps({ codeLength: 6 })
    expect(wrapper.get('[autocomplete="one-time-code"]').attributes('maxlength')).toBe('6')
  })

  it('shows an opt-in host strength assessment only for a new password', async () => {
    const assess = vi.fn(() => ({
      score: 2 as const,
      label: 'Host assessment',
      hint: 'Use a unique password',
    }))
    const wrapper = mount(NovaAuthForm, {
      props: { adapter: adapter().auth, passwordStrength: assess },
    })
    wrappers.push(wrapper)
    wrapper.vm.fill({ password: 'example' })
    await flushPromises()
    expect(wrapper.find('meter').exists()).toBe(false)
    wrapper.vm.setMode('register')
    wrapper.vm.fill({ password: 'example' })
    await flushPromises()
    expect(wrapper.get('meter').attributes('value')).toBe('2')
    expect(wrapper.text()).toContain('Host assessment')
    expect(wrapper.text()).toContain('Use a unique password')
  })
})
