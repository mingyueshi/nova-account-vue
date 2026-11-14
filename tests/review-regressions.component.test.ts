import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import Center from '../src/components/NovaAccountCenter.vue'
import NovaField from '../src/components/NovaField.vue'
import NovaDialog from '../src/components/NovaDialog.vue'
import NovaAuthForm from '../src/components/NovaAuthForm.vue'
import {
  createDemoAccountAdapter,
  createInitialAccount,
  DEMO_ACCOUNT_VALUES,
} from '../demo/account'
import { createDemoAuthAdapter } from '../demo/auth'
import { h, ref } from 'vue'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function keep<T extends VueWrapper>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find((item) => item.text() === label)!
}
async function center() {
  const adapter = createDemoAccountAdapter({ wait: () => Promise.resolve() })
  const wrapper = keep(
    mount(Center, {
      props: { adapter, simulated: true, page: 'profile' },
      attachTo: document.body,
    }),
  )
  await flushPromises()
  return { adapter, wrapper }
}

describe('review regressions', () => {
  it('keeps a hidden profile draft when saving preferences and guards logout from another page', async () => {
    const { wrapper } = await center()
    await wrapper.get('input[autocomplete="nickname"]').setValue('Preserved profile')
    await wrapper.setProps({ page: 'notifications' })
    await wrapper.get('input[aria-label="邮件摘要"]').setValue(true)
    await wrapper.get('main form').trigger('submit')
    await flushPromises()
    await wrapper.setProps({ page: 'overview' })
    await button(wrapper, '退出登录').trigger('click')
    expect(wrapper.emitted('logout')).toBeUndefined()
    expect(wrapper.get('dialog[open]').text()).toContain('还有未保存的修改')
    await button(wrapper, '继续编辑').trigger('click')
    await wrapper.setProps({ page: 'profile' })
    expect(wrapper.get('input[autocomplete="nickname"]').element).toHaveProperty(
      'value',
      'Preserved profile',
    )
  })

  it('synchronizes clean fields from a host refresh while keeping a different dirty draft', async () => {
    const { wrapper, adapter } = await center()
    await wrapper.get('input[autocomplete="nickname"]').setValue('Local profile')
    const updated = createInitialAccount(Date.now())
    updated.notifications.email = true
    updated.profile.bio = 'Fresh server bio'
    adapter.load = vi.fn(async () => updated)
    await wrapper.vm.refresh()
    await wrapper.setProps({ page: 'notifications' })
    expect(wrapper.get('input[aria-label="邮件摘要"]').element).toHaveProperty('checked', true)
    await wrapper.setProps({ page: 'profile' })
    expect(wrapper.get('input[autocomplete="nickname"]').element).toHaveProperty(
      'value',
      'Local profile',
    )
    expect(wrapper.get('textarea').element).toHaveProperty('value', 'Fresh server bio')
  })

  it('honors the host avatar size limit before reading a file', async () => {
    const { wrapper } = await center()
    await wrapper.setProps({ avatarMaxBytes: 2 })
    const reader = vi.spyOn(FileReader.prototype, 'readAsDataURL')
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['abc'], 'avatar.png', { type: 'image/png' })],
    })
    await input.trigger('change')
    await flushPromises()
    expect(reader).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('2 字节')
  })

  it('keeps both drafts across authoritative host navigation and only discards the active draft', async () => {
    const { wrapper } = await center()
    await wrapper.get('input[autocomplete="nickname"]').setValue('Host draft')
    await wrapper.setProps({ page: 'notifications' })
    await wrapper.get('input[aria-label="邮件摘要"]').setValue(true)
    await wrapper.setProps({ page: 'profile' })
    expect(wrapper.get('input[autocomplete="nickname"]').element).toHaveProperty(
      'value',
      'Host draft',
    )
    await button(wrapper, '取消').trigger('click')
    await wrapper.setProps({ page: 'notifications' })
    expect(wrapper.get('input[aria-label="邮件摘要"]').element).toHaveProperty('checked', true)
    expect(wrapper.emitted('update:page')).toBeUndefined()
    await wrapper.get('[data-page="overview"]').trigger('click')
    expect(wrapper.get('dialog[open]').text()).toContain('还有未保存的修改')
  })

  it('preserves unsaved fields when a host refreshes a new snapshot', async () => {
    const { wrapper, adapter } = await center()
    await wrapper.get('input[autocomplete="nickname"]').setValue('Local draft')
    const updated = createInitialAccount(Date.now())
    updated.profile.nickname = 'Remote profile'
    adapter.load = vi.fn(async () => updated)
    await wrapper.vm.refresh()
    await flushPromises()
    expect(wrapper.get('input[autocomplete="nickname"]').element).toHaveProperty(
      'value',
      'Local draft',
    )
    await button(wrapper, '取消').trigger('click')
    expect(wrapper.get('input[autocomplete="nickname"]').element).toHaveProperty(
      'value',
      'Remote profile',
    )
  })

  it('closes a deleted message after host refresh instead of showing a device confirmation', async () => {
    const { wrapper, adapter } = await center()
    await wrapper.setProps({ page: 'messages' })
    await wrapper.get('.nova-message-list article button').trigger('click')
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    const updated = createInitialAccount(Date.now())
    updated.messages = []
    adapter.load = vi.fn(async () => updated)
    await wrapper.vm.refresh()
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('确认退出该设备的会话')
  })

  it.each(['size', 'type'])(
    'rejects an invalid avatar %s before allocating a FileReader',
    async (kind) => {
      const { wrapper, adapter } = await center()
      const upload = vi.spyOn(adapter, 'uploadAvatar')
      const reader = vi.spyOn(FileReader.prototype, 'readAsDataURL')
      const file = new File(['x'], 'avatar.png', {
        type: kind === 'type' ? 'text/plain' : 'image/png',
      })
      if (kind === 'size') Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 + 1 })
      const input = wrapper.get('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file] })
      await input.trigger('change')
      await flushPromises()
      expect(reader).not.toHaveBeenCalled()
      expect(upload).not.toHaveBeenCalled()
      expect(wrapper.get('[role="alert"]').text()).not.toBe('')
    },
  )

  it('validates empty and mismatched passwords locally, focuses errors and permits correction', async () => {
    const { wrapper, adapter } = await center()
    const change = vi.spyOn(adapter, 'changePassword')
    await wrapper.setProps({ page: 'security' })
    await button(wrapper, '修改').trigger('click')
    await wrapper.get('dialog[open] form').trigger('submit')
    expect(change).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(wrapper.get('dialog[open] [aria-invalid="true"]').element)
    expect(wrapper.findAll('dialog[open] [aria-invalid="true"]').length).toBeGreaterThan(0)
    wrapper.vm.fillSecurity({ ...DEMO_ACCOUNT_VALUES, confirmPassword: 'different' })
    await wrapper.get('dialog[open] form').trigger('submit')
    expect(change).not.toHaveBeenCalled()
    expect(wrapper.get('dialog[open]').text()).toContain('两次输入的密码不一致')
    wrapper.vm.fillSecurity(DEMO_ACCOUNT_VALUES)
    await wrapper.get('dialog[open] form').trigger('submit')
    await flushPromises()
    expect(change).toHaveBeenCalledOnce()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
  })

  it('honors a host field id and combines host and generated descriptions', async () => {
    const wrapper = keep(
      mount(NovaField, {
        props: { id: 'host-email', modelValue: '', label: 'Email', hint: 'Hint' },
        attrs: { 'aria-describedby': 'host-help' },
      }),
    )
    expect(wrapper.get('input').attributes('id')).toBe('host-email')
    expect(wrapper.get('label').attributes('for')).toBe('host-email')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('host-help host-email-hint')
  })

  it('updates host field descriptions even when only fallthrough attributes change', async () => {
    const help = ref('first-help')
    const wrapper = keep(
      mount({
        render: () =>
          h(NovaField, {
            modelValue: '',
            label: 'Email',
            id: 'email',
            'aria-describedby': help.value,
          }),
      }),
    )
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('first-help')
    help.value = 'second-help'
    await flushPromises()
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('second-help')
  })

  it('does not claim modality when native modal dialogs are unavailable', async () => {
    // jsdom has no native showModal implementation.
    expect(typeof HTMLDialogElement.prototype.showModal).toBe('undefined')
    const wrapper = keep(mount(NovaDialog, { props: { open: true, title: 'Fallback' } }))
    await flushPromises()
    expect(wrapper.attributes('open')).toBeDefined()
    expect(wrapper.attributes('aria-modal')).not.toBe('true')
  })

  it('isolates a throwing optional password-strength presenter from the form', async () => {
    const wrapper = keep(
      mount(NovaAuthForm, {
        props: {
          adapter: createDemoAuthAdapter(),
          passwordStrength: () => {
            throw new Error('Host presenter failed')
          },
        },
      }),
    )
    wrapper.vm.setMode('register')
    wrapper.vm.fill({ password: 'draft-password' })
    await flushPromises()
    expect(wrapper.get('input[autocomplete="new-password"]').element).toHaveProperty(
      'value',
      'draft-password',
    )
    expect(wrapper.find('meter').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('connects login tabs to a labelled panel and retains the actual form', async () => {
    const wrapper = keep(mount(NovaAuthForm, { props: { adapter: createDemoAuthAdapter() } }))
    const tab = wrapper.get('[role="tab"][aria-selected="true"]')
    const panel = wrapper.get('[role="tabpanel"]')
    expect(panel.attributes('id')).toBe(tab.attributes('aria-controls'))
    expect(panel.attributes('aria-labelledby')).toBe(tab.attributes('id'))
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
