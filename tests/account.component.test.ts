// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import NovaAccountCenter from '../src/components/NovaAccountCenter.vue'
import {
  createDemoAccountAdapter,
  createInitialAccount,
  DEMO_ACCOUNT_VALUES,
} from '../demo/account'
import type { AccountAdapter, AccountPage, CodeDelivery } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
async function create(
  simulated = true,
  adapter: AccountAdapter = createDemoAccountAdapter({ wait: () => Promise.resolve() }),
) {
  const wrapper = mount(NovaAccountCenter, {
    props: { adapter, simulated },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((item) => item.text() === label)
  if (!found) throw new Error(`Missing button ${label}`)
  return found
}

describe('NovaAccountCenter', () => {
  it('closes mobile navigation before guarding a draft and restores its stable trigger', async () => {
    const wrapper = await create()
    const trigger = wrapper.get('[data-mobile-nav-trigger]')
    await trigger.trigger('click')
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-mobile-page="overview"]').attributes('aria-current')).toBe('page')
    await wrapper.get('[data-mobile-page="profile"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('个人资料')
    await wrapper.get('input[autocomplete="nickname"]').setValue('Mobile draft')
    await trigger.trigger('click')
    await flushPromises()
    await wrapper.get('[data-mobile-page="overview"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('dialog[open]')).toHaveLength(1)
    expect(wrapper.get('dialog[open]').text()).toContain('还有未保存的修改')
    await button(wrapper, '继续编辑').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(trigger.element)
    expect(wrapper.get<HTMLInputElement>('input[autocomplete="nickname"]').element.value).toBe(
      'Mobile draft',
    )
    await trigger.trigger('click')
    await flushPromises()
    await wrapper.get('[data-mobile-page="overview"]').trigger('click')
    await flushPromises()
    await button(wrapper, '放弃并离开').trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('账户概览')
  })

  it('keeps mobile choices within host pages and closes the sheet on authoritative page changes', async () => {
    const wrapper = await create()
    await wrapper.setProps({
      pages: ['security', 'custom:tasks'],
      extraPages: [
        { id: 'custom:tasks', label: '我的待办', description: '待办事项', group: '我的生活' },
      ],
    })
    await wrapper.get('[data-mobile-nav-trigger]').trigger('click')
    await flushPromises()
    expect(
      wrapper.findAll('[data-mobile-page]').map((item) => item.attributes('data-mobile-page')),
    ).toEqual(['security', 'custom:tasks'])
    await wrapper.setProps({ page: 'custom:tasks' })
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.get('[data-mobile-nav-trigger]').text()).toContain('我的待办')
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })

  it('rejects invalid replacement emails locally and permits a corrected address', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const requestCode = vi.fn(base.requestEmailChangeCode)
    const wrapper = await create(true, { ...base, requestEmailChangeCode: requestCode })
    await wrapper.get('[data-page="security"]').trigger('click')
    await button(wrapper, '更换').trigger('click')
    wrapper.vm.fillSecurity({ ...DEMO_ACCOUNT_VALUES, email: 'bad-email' })
    await flushPromises()
    await button(wrapper, '获取演示码').trigger('click')
    expect(requestCode).not.toHaveBeenCalled()
    expect(wrapper.get('dialog[open] [role="alert"]').text()).toContain('有效的邮箱地址')
    expect(document.activeElement).toBe(wrapper.get('dialog[open] input[type="email"]').element)
    wrapper.vm.fillSecurity({ ...DEMO_ACCOUNT_VALUES, email: ` ${DEMO_ACCOUNT_VALUES.email} ` })
    await flushPromises()
    await button(wrapper, '获取演示码').trigger('click')
    await flushPromises()
    expect(requestCode).toHaveBeenCalledOnce()
    expect(requestCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: DEMO_ACCOUNT_VALUES.email }),
      expect.anything(),
    )
  })

  it.each([false, true])(
    'keeps keyboard focus during mark-read and after unread filtering (%s)',
    async (unreadOnly) => {
      const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
      let finish!: () => void
      const wrapper = await create(true, {
        ...base,
        markMessageRead: async (id, context) => {
          await new Promise<void>((resolve) => {
            finish = resolve
          })
          return base.markMessageRead(id, context)
        },
      })
      await wrapper.get('[data-page="messages"]').trigger('click')
      if (unreadOnly) await button(wrapper, '未读 4').trigger('click')
      const action = button(wrapper, '标为已读')
      const article = action.element.closest('article')!
      const reader = article.querySelector('[data-message-open]')!
      ;(action.element as HTMLElement).focus()
      await action.trigger('click')
      expect(document.activeElement?.getAttribute('role')).toBe('status')
      finish()
      await flushPromises()
      expect(document.activeElement).toBe(
        unreadOnly ? wrapper.get('[data-message-open="welcome-space"]').element : reader,
      )
    },
  )
  it('transfers pointer-read feedback even when activation did not focus the button', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    let finish!: () => void
    const wrapper = await create(true, {
      ...base,
      markMessageRead: async (id, context) => {
        await new Promise<void>((resolve) => {
          finish = resolve
        })
        return base.markMessageRead(id, context)
      },
    })
    await wrapper.get('[data-page="messages"]').trigger('click')
    await button(wrapper, '未读 4').trigger('click')
    ;(wrapper.get('h1').element as HTMLElement).focus()
    const action = button(wrapper, '标为已读')
    expect(document.activeElement).not.toBe(action.element)
    await action.trigger('click')
    expect(document.activeElement?.getAttribute('role')).toBe('status')
    finish()
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-message-open="welcome-space"]').element)
  })

  it('returns from a read message to the next unread item and then the empty state', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="messages"]').trigger('click')
    await button(wrapper, '未读 4').trigger('click')
    for (let count = 4; count > 0; count--) {
      const origin = wrapper.get('[data-message-open]')
      ;(origin.element as HTMLElement).focus()
      await origin.trigger('click')
      await flushPromises()
      await wrapper.get('[data-message-close]').trigger('click')
      await flushPromises()
      expect(document.activeElement).toBe(
        count > 1
          ? wrapper.get('[data-message-open]').element
          : wrapper.get('[data-message-empty]').element,
      )
    }
  })

  it('keeps a failed read retry inside the message dialog and focuses its stable close action', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const mark = vi.fn(base.markMessageRead).mockRejectedValueOnce(new Error('Try again'))
    const wrapper = await create(true, { ...base, markMessageRead: mark })
    await wrapper.get('[data-page="messages"]').trigger('click')
    await wrapper.get('[data-message-open]').trigger('click')
    await flushPromises()
    const dialog = wrapper.get('dialog[open]')
    expect(dialog.get('[role="alert"]').text()).toBe('Try again')
    const retry = dialog.findAll('button').find((item) => item.text() === '标为已读')!
    ;(retry.element as HTMLElement).focus()
    await retry.trigger('click')
    await flushPromises()
    expect(mark).toHaveBeenCalledTimes(2)
    expect(dialog.find('[role="alert"]').exists()).toBe(false)
    expect(document.activeElement).toBe(dialog.get('[data-message-close]').element)
  })

  it.each([false, true])(
    'keeps bulk-read feedback focused on success or failure (%s)',
    async (fail) => {
      const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
      const wrapper = await create(true, {
        ...base,
        markAllMessagesRead: fail
          ? async () => {
              throw new Error('Try again')
            }
          : base.markAllMessagesRead,
      })
      await wrapper.get('[data-page="messages"]').trigger('click')
      const action = button(wrapper, '全部标为已读')
      ;(action.element as HTMLElement).focus()
      await action.trigger('click')
      await flushPromises()
      expect(document.activeElement).toBe(
        wrapper.get(fail ? '[data-account-error]' : '[data-account-notice]').element,
      )
    },
  )

  it('identifies the device before signing out and focuses the resulting notice when its row disappears', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="devices"]').trigger('click')
    const action = wrapper.get('[aria-label="退出 iPhone · Safari"]')
    ;(action.element as HTMLElement).focus()
    await action.trigger('click')
    const dialog = wrapper.get('dialog[open]')
    expect(dialog.get('.nova-device-confirm').text()).toContain('iPhone · Safari')
    expect(dialog.get('.nova-device-confirm').text()).toContain('iOS · 杭州')
    await dialog.get('form').trigger('submit')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-account-notice]').element)
  })

  it('validates two-step confirmation before submitting and clears corrected errors', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const set = vi.fn(base.setTwoStep)
    const wrapper = await create(true, { ...base, setTwoStep: set })
    await wrapper.get('[data-page="security"]').trigger('click')
    await button(wrapper, '开启').trigger('click')
    const form = wrapper.get('dialog[open] form')
    await form.trigger('submit')
    await flushPromises()
    expect(set).not.toHaveBeenCalled()
    expect(form.findAll('[role="alert"]')).toHaveLength(2)
    wrapper.vm.fillSecurity({ currentPassword: '123456', code: '12' })
    await flushPromises()
    expect(form.findAll('[role="alert"]')).toHaveLength(1)
    wrapper.vm.fillSecurity({ code: '123456' })
    await flushPromises()
    expect(form.findAll('[role="alert"]')).toHaveLength(0)
    await form.trigger('submit')
    await flushPromises()
    expect(set).toHaveBeenCalledOnce()
  })

  it('prevents unload only for dirty drafts, including hidden drafts, and removes the listener', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const wrapper = await create()
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(unload()).toBe(false)
    await wrapper.get('[data-page="profile"]').trigger('click')
    await wrapper.get('input[autocomplete="nickname"]').setValue('Unsaved')
    expect(unload()).toBe(true)
    await wrapper.setProps({ page: 'overview' })
    expect(unload()).toBe(true)
    await wrapper.setProps({ page: 'profile' })
    await button(wrapper, '取消').trigger('click')
    expect(unload()).toBe(false)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('paginates and filters security activity, clamps refreshed pages and shows an empty category', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const state = createInitialAccount(Date.now())
    state.activity = Array.from({ length: 9 }, (_, i) => ({
      id: `event-${i}`,
      at: new Date().toISOString(),
      title: `Event ${i}`,
      description: 'Activity',
      category: i < 8 ? ('credentials' as const) : ('devices' as const),
    }))
    const wrapper = await create(true, { ...base, load: async () => structuredClone(state) })
    await wrapper.get('[data-page="security"]').trigger('click')
    const activity = wrapper.get('.nova-security-activity')
    expect(activity.findAll('li')).toHaveLength(4)
    await activity.get('[aria-label="下一页安全活动"]').trigger('click')
    expect(activity.text()).toContain('Event 4')
    await activity.get('[aria-label="上一页安全活动"]').trigger('click')
    expect(activity.text()).toContain('Event 0')
    await activity.get('[aria-label="下一页安全活动"]').trigger('click')
    state.activity = state.activity.slice(0, 1)
    await wrapper.vm.refresh()
    await flushPromises()
    expect(activity.find('[aria-label="下一页安全活动"]').exists()).toBe(false)
    expect(activity.find('[aria-label="上一页安全活动"]').exists()).toBe(false)
    await activity
      .findAll('button')
      .find((item) => item.text() === '设备')!
      .trigger('click')
    expect(activity.text()).toContain('暂时没有此类安全活动')
    await activity
      .findAll('button')
      .find((item) => item.text() === '凭据')!
      .trigger('click')
    expect(activity.text()).toContain('Event 0')
  })

  it('cancels then confirms revoking a single device without revoking the current session', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const revoke = vi.fn(base.revokeDevice)
    const wrapper = await create(true, { ...base, revokeDevice: revoke })
    await wrapper.get('[data-page="devices"]').trigger('click')
    await wrapper.get('button[aria-label="退出 iPhone · Safari"]').trigger('click')
    await button(wrapper, '取消').trigger('click')
    expect(revoke).not.toHaveBeenCalled()
    await wrapper.get('button[aria-label="退出 iPhone · Safari"]').trigger('click')
    await wrapper.get('dialog[open] form').trigger('submit')
    await flushPromises()
    expect(revoke).toHaveBeenCalledWith('phone', expect.objectContaining({ revision: '0' }))
    expect(wrapper.findAll('main article')).toHaveLength(2)
    expect(wrapper.get('main').text()).toContain('Mac · Chrome')
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
  })
  it('renders profile drafts as text and guards unsaved navigation', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="profile"]').trigger('click')
    await wrapper.get('input[autocomplete="nickname"]').setValue('<img src=x>')
    await wrapper.get('textarea').setValue('Fictional profile')
    await wrapper.get('[data-page="overview"]').trigger('click')
    expect(wrapper.find('dialog[open]').text()).toContain('还有未保存的修改')
    await button(wrapper, '继续编辑').trigger('click')
    expect(wrapper.get('h1').text()).toBe('个人资料')
    await wrapper.get('main form').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-page="overview"]').trigger('click')
    expect(wrapper.text()).toContain('<img src=x>')
    expect(wrapper.findAll('img')).toHaveLength(0)
  })
  it('discard navigates and leaves stored profile unchanged', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="profile"]').trigger('click')
    await wrapper.get('input[autocomplete="nickname"]').setValue('Discard me')
    await wrapper.get('[data-page="devices"]').trigger('click')
    await button(wrapper, '放弃并离开').trigger('click')
    expect(wrapper.get('h1').text()).toBe('登录设备')
    await wrapper.get('[data-page="profile"]').trigger('click')
    expect((wrapper.get('input[autocomplete="nickname"]').element as HTMLInputElement).value).toBe(
      'Nova',
    )
  })
  it('messages update counts and show a clear unread empty state', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="messages"]').trigger('click')
    expect(wrapper.text()).toContain('未读 4')
    await button(wrapper, '全部标为已读').trigger('click')
    await flushPromises()
    await button(wrapper, '未读 0').trigger('click')
    expect(wrapper.text()).toContain('这里暂时没有未读消息')
  })
  it('requires confirmation before revoking devices and protects current device', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="devices"]').trigger('click')
    expect(wrapper.findAll('main article')).toHaveLength(3)
    expect(wrapper.find('button[aria-label="退出 Mac · Chrome"]').exists()).toBe(false)
    await button(wrapper, '退出其他设备').trigger('click')
    expect(wrapper.findAll('main article')).toHaveLength(3)
    await wrapper.get('dialog[open] form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('main article')).toHaveLength(1)
    expect(wrapper.get('main article').text()).toContain('当前设备')
  })
  it('exposes safe security form prefill and clears secrets when dialog closes', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="security"]').trigger('click')
    await button(wrapper, '修改').trigger('click')
    wrapper.vm.fillSecurity(DEMO_ACCOUNT_VALUES)
    await flushPromises()
    expect(
      (wrapper.get('dialog[open] input[type="password"]').element as HTMLInputElement).value,
    ).toBe(DEMO_ACCOUNT_VALUES.currentPassword)
    await button(wrapper, '取消').trigger('click')
    await button(wrapper, '修改').trigger('click')
    expect(
      (wrapper.get('dialog[open] input[type="password"]').element as HTMLInputElement).value,
    ).toBe('')
  })
  it('does not let a late email code response revive a closed or reopened modal', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    let resolve!: (value: CodeDelivery) => void
    const adapter: AccountAdapter = {
      ...base,
      requestEmailChangeCode: () =>
        new Promise((done) => {
          resolve = done
        }),
    }
    const wrapper = await create(true, adapter)
    await wrapper.get('[data-page="security"]').trigger('click')
    await button(wrapper, '更换').trigger('click')
    wrapper.vm.fillSecurity(DEMO_ACCOUNT_VALUES)
    await flushPromises()
    await button(wrapper, '获取演示码').trigger('click')
    await button(wrapper, '取消').trigger('click')
    await button(wrapper, '更换').trigger('click')
    resolve({ expiresAt: Date.now() + 120000, retryAfter: 30, demoCode: '123456' })
    await flushPromises()
    expect(wrapper.get('dialog[open]').text()).not.toContain('演示验证码：')
    expect(wrapper.get('dialog[open] button[type="submit"]').attributes('disabled')).toBeDefined()
  })
  it('production does not expose pretend MFA/password mutation UI without a slot', async () => {
    const wrapper = await create(false)
    await wrapper.get('[data-page="security"]').trigger('click')
    expect(wrapper.get('main').text()).toContain('真实二次认证流程')
    expect(wrapper.findAll('main button').some((item) => item.text() === '修改')).toBe(false)
    expect(wrapper.findAll('main button').some((item) => item.text() === '开启')).toBe(false)
  })
  it('switches adapter identity without accepting an old pending load', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    let resolve!: (value: ReturnType<typeof createInitialAccount>) => void
    const oldAdapter: AccountAdapter = {
      ...base,
      load: () =>
        new Promise((done) => {
          resolve = done
        }),
    }
    const wrapper = await create(true, oldAdapter)
    const replacement = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    await replacement.updateProfile(
      { nickname: 'Replacement', bio: '', avatar: 'teal' },
      { revision: '0', signal: new AbortController().signal, requestId: 'replacement' },
    )
    await wrapper.setProps({ adapter: replacement })
    await flushPromises()
    expect(wrapper.text()).toContain('Replacement')
    resolve(createInitialAccount(Date.now()))
    await flushPromises()
    expect(wrapper.text()).toContain('Replacement')
    expect(wrapper.text()).not.toContain('你好，Nova')
  })
  it('returns cancelled notification edits to the saved status instead of a disabled action', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="notifications"]').trigger('click')
    await wrapper.get('[aria-label="邮件摘要"]').setValue(true)
    const cancel = button(wrapper, '取消')
    ;(cancel.element as HTMLElement).focus()
    await cancel.trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="邮件摘要"]').element).toHaveProperty('checked', false)
    expect(document.activeElement).toBe(
      wrapper.get('[data-account-savebar] [role="status"]').element,
    )
  })

  it('protects unsaved notification preferences on logout', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="notifications"]').trigger('click')
    await wrapper.get('input[aria-label="邮件摘要"]').setValue(true)
    await button(wrapper, '退出登录').trigger('click')
    expect(wrapper.emitted('logout')).toBeUndefined()
    await button(wrapper, '放弃并离开').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })
})

describe('navigation during initial load', () => {
  it('finishes the shared load after both internal and external page changes', async () => {
    const snapshot = createInitialAccount(Date.now())
    let resolve!: (value: typeof snapshot) => void
    let signal!: AbortSignal
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const adapter: AccountAdapter = {
      ...base,
      load: (context) => {
        signal = context.signal
        return new Promise((done) => {
          resolve = done
        })
      },
    }
    const wrapper = await create(false, adapter)
    await wrapper.get('[data-page="messages"]').trigger('click')
    await wrapper.setProps({ page: 'devices' })
    expect(signal.aborted).toBe(false)
    resolve(snapshot)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('登录设备')
    expect(wrapper.findAll('main article')).toHaveLength(3)
    expect(wrapper.get('main').text()).not.toContain('正在加载账户')
  })
})

describe('restricted account pages', () => {
  async function restricted(props: {
    pages: AccountPage[]
    page?: AccountPage
    initialPage?: AccountPage
  }) {
    const wrapper = mount(NovaAccountCenter, {
      props: {
        adapter: createDemoAccountAdapter({ wait: () => Promise.resolve() }),
        simulated: true,
        ...props,
      },
      attachTo: document.body,
    })
    wrappers.push(wrapper)
    await flushPromises()
    return wrapper
  }
  it('excludes unavailable overview shortcuts as well as navigation tabs', async () => {
    const wrapper = await restricted({ pages: ['overview', 'security'] })
    expect(wrapper.findAll('[data-page]').map((item) => item.attributes('data-page'))).toEqual([
      'overview',
      'security',
    ])
    expect(wrapper.findAll('main button').map((item) => item.text())).toEqual([
      expect.stringContaining('账号安全'),
    ])
    await wrapper.get('main button').trigger('click')
    expect(wrapper.get('h1').text()).toBe('账号安全')
  })
  it('keeps the allowed edit-profile shortcut working', async () => {
    const wrapper = await restricted({ pages: ['overview', 'profile'] })
    await button(wrapper, '编辑资料').trigger('click')
    expect(wrapper.get('h1').text()).toBe('个人资料')
  })
  it('rejects a queued destination that the host has since removed', async () => {
    const wrapper = await restricted({ pages: ['profile', 'security'] })
    await wrapper.get('input[autocomplete="nickname"]').setValue('Unsaved')
    await wrapper.get('[data-page="security"]').trigger('click')
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    await wrapper.setProps({ pages: ['profile'] })
    await button(wrapper, '放弃并离开').trigger('click')
    expect(wrapper.get('h1').text()).toBe('个人资料')
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })
  it('starts on an available page and honors only allowed initial pages', async () => {
    const wrapper = await restricted({ pages: ['profile', 'security'], initialPage: 'messages' })
    expect(wrapper.get('h1').text()).toBe('个人资料')
    expect(wrapper.emitted('update:page')).toBeUndefined()
    const selected = await restricted({ pages: ['profile', 'security'], initialPage: 'security' })
    expect(selected.get('h1').text()).toBe('账号安全')
  })
  it('reconciles a removed page and does not revive it when the list expands', async () => {
    const wrapper = await restricted({ pages: ['profile', 'security'] })
    await wrapper.get('input[autocomplete="nickname"]').setValue('Retained draft')
    await wrapper.setProps({ pages: ['security'] })
    expect(wrapper.get('h1').text()).toBe('账号安全')
    expect(wrapper.emitted('update:page')).toBeUndefined()
    await wrapper.setProps({ pages: ['profile', 'security'] })
    expect(wrapper.get('h1').text()).toBe('账号安全')
    await wrapper.get('[data-page="profile"]').trigger('click')
    expect((wrapper.get('input[autocomplete="nickname"]').element as HTMLInputElement).value).toBe(
      'Retained draft',
    )
  })
  it('falls back for an unavailable controlled page without echoing updates', async () => {
    const wrapper = await restricted({ pages: ['profile', 'security'], page: 'messages' })
    expect(wrapper.get('h1').text()).toBe('个人资料')
    expect(wrapper.emitted('update:page')).toBeUndefined()
    await wrapper.get('[data-page="security"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([['security']])
    expect(wrapper.get('h1').text()).toBe('个人资料')
    await wrapper.setProps({ page: 'security' })
    expect(wrapper.get('h1').text()).toBe('账号安全')
    await wrapper.setProps({ pages: ['profile'] })
    expect(wrapper.get('h1').text()).toBe('个人资料')
    expect(wrapper.emitted('update:page')).toEqual([['security']])
  })
  it('resets an exchanged adapter onto an allowed internal page', async () => {
    const wrapper = await restricted({ pages: ['profile', 'security'], initialPage: 'messages' })
    await wrapper.setProps({ adapter: createDemoAccountAdapter({ wait: () => Promise.resolve() }) })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('个人资料')
    await wrapper.setProps({ pages: ['profile', 'security', 'messages'] })
    expect(wrapper.get('h1').text()).toBe('个人资料')
  })
  it('shows an empty state in place of excluded pages and controls', async () => {
    const wrapper = await restricted({ pages: [], page: 'security' })
    expect(wrapper.get('main').text()).toBe('暂无可用页面')
    expect(wrapper.findAll('[data-page]')).toHaveLength(0)
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.findAll('main button, main form, main section')).toHaveLength(0)
    expect(wrapper.emitted('update:page')).toBeUndefined()
    await wrapper.setProps({ pages: ['security'] })
    expect(wrapper.get('h1').text()).toBe('账号安全')
    expect(wrapper.get('main').text()).not.toContain('暂无可用页面')
    await wrapper.setProps({ pages: [] })
    expect(wrapper.get('main').text()).toBe('暂无可用页面')
    expect(wrapper.findAll('main button, main form, main section')).toHaveLength(0)
  })
})

describe('two-step availability', () => {
  it('shows two-step by default for direct account-center consumers', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="security"]').trigger('click')
    expect(button(wrapper, '开启').exists()).toBe(true)
  })
  it('closes a removed two-step dialog and prevents its stale form from submitting', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const setTwoStep = vi.fn(base.setTwoStep)
    const wrapper = await create(true, { ...base, setTwoStep })
    await wrapper.setProps({ twoStep: true })
    await wrapper.get('[data-page="security"]').trigger('click')
    await button(wrapper, '开启').trigger('click')
    const form = wrapper.get('dialog[open] form')
    wrapper.vm.fillSecurity(DEMO_ACCOUNT_VALUES)
    await wrapper.setProps({ twoStep: false })
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    await form.trigger('submit')
    expect(setTwoStep).not.toHaveBeenCalled()
    await wrapper.setProps({ twoStep: true })
    await button(wrapper, '开启').trigger('click')
    expect(
      (wrapper.get('dialog[open] input[type="password"]').element as HTMLInputElement).value,
    ).toBe('')
  })
  it('cancels a pending two-step operation when its UI is removed', async () => {
    const base = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    let signal!: AbortSignal
    let resolve!: (value: ReturnType<typeof createInitialAccount>) => void
    const setTwoStep: AccountAdapter['setTwoStep'] = (_input, context) => {
      signal = context.signal
      return new Promise((done) => {
        resolve = done
      })
    }
    const wrapper = await create(true, { ...base, setTwoStep })
    await wrapper.setProps({ twoStep: true })
    await wrapper.get('[data-page="security"]').trigger('click')
    await button(wrapper, '开启').trigger('click')
    wrapper.vm.fillSecurity(DEMO_ACCOUNT_VALUES)
    await wrapper.get('dialog[open] form').trigger('submit')
    await wrapper.setProps({ twoStep: false })
    expect(signal.aborted).toBe(true)
    const stale = createInitialAccount(Date.now())
    stale.security.twoStepEnabled = true
    resolve(stale)
    await flushPromises()
    await wrapper.setProps({ twoStep: true })
    expect(button(wrapper, '开启').exists()).toBe(true)
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
  })
})

describe('adaptive account workspaces', () => {
  it('moves an open message into the inline reader as content grows, then disconnects', async () => {
    let resize!: (entries: { contentRect: { width: number } }[]) => void
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: typeof resize) {
          resize = callback
        }
        observe = vi.fn()
        disconnect = disconnect
      },
    )
    const wrapper = await create()
    await wrapper.get('[data-page="messages"]').trigger('click')
    await wrapper.get('.nova-message-list article button').trigger('click')
    await flushPromises()
    const title = wrapper.get('.nova-message-list h2').text()
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    resize([{ contentRect: { width: 1200 } }])
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.get('.nova-message-reader h2').text()).toBe(title)
    expect(wrapper.get('.nova-message-list article').attributes('data-message-read')).toBe('true')
    resize([{ contentRect: { width: 600 } }])
    await flushPromises()
    expect(wrapper.find('.nova-message-reader').exists()).toBe(false)
    await wrapper.get('.nova-message-list article button').trigger('click')
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(disconnect).toHaveBeenCalledOnce()
  })
  it('previews unsaved notification choices and restores the saved choices on cancel', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="notifications"]').trigger('click')
    const preview = wrapper.get('.nova-notification-previews')
    expect(preview.findAll('article')).toHaveLength(2)
    await wrapper.get('input[aria-label="邮件摘要"]').setValue(true)
    expect(preview.findAll('article')).toHaveLength(3)
    await button(wrapper, '取消').trigger('click')
    expect(preview.findAll('article')).toHaveLength(2)
    for (const input of wrapper.findAll('input[role="switch"]')) await input.setValue(false)
    expect(preview.findAll('article')).toHaveLength(0)
    expect(preview.get('p').text()).not.toBe('')
  })
})

describe('account form recovery', () => {
  it('rejects a blank nickname before calling the adapter and focuses its field', async () => {
    const adapter = createDemoAccountAdapter({ wait: () => Promise.resolve() })
    const update = vi.spyOn(adapter, 'updateProfile')
    const wrapper = await create(true, adapter)
    await wrapper.setProps({ page: 'profile' })
    const nickname = wrapper.get('input[autocomplete="nickname"]')
    await nickname.setValue('   ')
    await wrapper.get('form.nova-profile-form').trigger('submit')
    expect(update).not.toHaveBeenCalled()
    expect(nickname.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(nickname.element)
    await nickname.setValue('我的日常')
    await wrapper.get('form.nova-profile-form').trigger('submit')
    await flushPromises()
    expect(update).toHaveBeenCalledOnce()
    expect(nickname.attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.text()).toContain('演示资料已保存')
  })
  it.each(['profile', 'notifications'] as const)(
    'keeps the %s draft and focuses a rejected save',
    async (page) => {
      const adapter = createDemoAccountAdapter({ wait: () => Promise.resolve() })
      const method = page === 'profile' ? 'updateProfile' : 'updateNotifications'
      vi.spyOn(adapter, method).mockRejectedValue(new Error('暂时无法保存，请重试。'))
      const wrapper = await create(true, adapter)
      await wrapper.setProps({ page })
      const field =
        page === 'profile'
          ? wrapper.get('input[autocomplete="nickname"]')
          : wrapper.get('input[aria-label="邮件摘要"]')
      await field.setValue(page === 'profile' ? '保留的昵称' : true)
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(document.activeElement).toBe(wrapper.get('[data-account-error]').element)
      expect(wrapper.get('[data-account-error]').text()).toContain('暂时无法保存')
      if (page === 'profile') expect((field.element as HTMLInputElement).value).toBe('保留的昵称')
      else expect((field.element as HTMLInputElement).checked).toBe(true)
      expect(wrapper.text()).toContain('有未保存的修改')
    },
  )
})
