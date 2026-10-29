// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import NovaAccountCenter from '../src/components/NovaAccountCenter.vue'
import {
  createDemoAccountAdapter,
  createInitialAccount,
  DEMO_ACCOUNT_VALUES,
} from '../demo/account'
import type { AccountAdapter, CodeDelivery } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
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
    resolve({ expiresAt: Date.now() + 120000, retryAfter: 30, demoCode: '246810' })
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
  it('protects unsaved notification preferences on logout', async () => {
    const wrapper = await create()
    await wrapper.get('[data-page="notifications"]').trigger('click')
    await wrapper.get('input[aria-label="邮件摘要"]').setValue(true)
    await button(wrapper, '↗ 退出登录').trigger('click')
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
