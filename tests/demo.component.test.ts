// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import App from '../demo/App.vue'

const wrappers: VueWrapper[] = []
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})
function create() {
  const wrapper = mount(App, { attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((item) => item.text() === label)
  if (!found) throw new Error(`Missing button ${label}`)
  return found
}
async function hostPanel(wrapper: VueWrapper) {
  await button(wrapper, '体验工具 ↗').trigger('click')
  await button(wrapper, '宿主集成演示').trigger('click')
  return wrapper.get('dialog[open]')
}

describe('demo host integration', () => {
  it('preserves the primary session, controlled page and unsaved draft across multi-instance preview', async () => {
    const wrapper = create()
    await button(wrapper, '体验工具 ↗').trigger('click')
    await button(wrapper, '用户中心预览').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.get('[data-page="profile"]').trigger('click')
    const input = wrapper.get('input[autocomplete="nickname"]')
    await input.setValue('Unsaved primary draft')
    const primary = wrapper.get('[data-nova-account-center]').element
    const host = await hostPanel(wrapper)
    const label = host.findAll('label').find((item) => item.text().includes('多实例主题隔离'))!
    await label.get('input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(wrapper.get('.demo-single').isVisible()).toBe(false)
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.get('[data-nova-account-center]').element).toBe(primary)
    expect(wrapper.findAll('.demo-multi-cell')).toHaveLength(2)
    await button(wrapper, '返回单实例演示').trigger('click')
    expect(wrapper.get('.demo-single').isVisible()).toBe(true)
    expect(wrapper.get('h1').text()).toBe('个人资料')
    expect(wrapper.get('[data-nova-account-center]').element).toBe(primary)
    expect((wrapper.get('input[autocomplete="nickname"]').element as HTMLInputElement).value).toBe(
      'Unsaved primary draft',
    )
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    await wrapper.get('main form').trigger('submit')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(wrapper.get('main').text()).toContain('演示资料已保存')
  })

  it.each([
    ['320', 'width=320,height=568'],
    ['390', 'width=390,height=844'],
  ])('requests the advertised %spx popup dimensions', async (width, features) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const wrapper = create()
    const host = await hostPanel(wrapper)
    const launch = button(wrapper, '打开预览窗口')
    expect(launch.attributes('disabled')).toBeDefined()
    expect(open).not.toHaveBeenCalled()
    const label = host.findAll('label').find((item) => item.text().includes('手机视口预览'))!
    await label.get('select').setValue(width)
    await launch.trigger('click')
    expect(open).toHaveBeenCalledExactlyOnceWith(
      window.location.href,
      'nova-viewport-preview',
      features,
    )
  })
})

describe('demo capability switches', () => {
  it('username identifier, trimmed modes and pages reshape both forms', async () => {
    const wrapper = create()
    const host = await hostPanel(wrapper)
    const identifierLabel = host
      .findAll('label')
      .find((item) => item.text().includes('账号字段 identifier'))!
    await identifierLabel.get('select').setValue('username')
    const modesGroup = host.get('[aria-label="登录方式裁剪"]')
    await modesGroup
      .findAll('label')
      .find((item) => item.text().includes('密码登录'))!
      .get('input[type="checkbox"]')
      .setValue(false)
    const pagesGroup = host.get('[aria-label="账户页裁剪"]')
    await pagesGroup
      .findAll('label')
      .find((item) => item.text().includes('登录设备'))!
      .get('input[type="checkbox"]')
      .setValue(false)
    await flushPromises()
    // Auth form falls back to the first allowed mode and collects a username.
    const main = wrapper.get('main')
    // A single remaining login mode hides the tablist entirely.
    expect(main.findAll('[role="tab"]')).toHaveLength(0)
    expect(main.text()).toContain('获取验证码')
    expect(main.text()).not.toContain('密码登录')
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true)
    await button(wrapper, '体验工具 ↗').trigger('click')
    await button(wrapper, '一键填入示例').trigger('click')
    expect((wrapper.get('input[autocomplete="username"]').element as HTMLInputElement).value).toBe(
      'demo',
    )
    // Preview renders the account center without the removed page.
    await button(wrapper, '体验工具 ↗').trigger('click')
    await button(wrapper, '用户中心预览').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    const pageIds = wrapper.findAll('[data-page]').map((tab) => tab.attributes('data-page'))
    expect(pageIds).not.toContain('devices')
    expect(pageIds).toContain('profile')
  })

  it('initialUser remounts the shell into a signed-in account center and logs the event', async () => {
    const wrapper = create()
    await hostPanel(wrapper)
    await button(wrapper, '以已验证会话进入（重挂载外壳）').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('账户概览')
    const host = await hostPanel(wrapper)
    const entry = host
      .findAll('[data-event-log] li')
      .find((item) => item.text().includes('initialUser'))
    expect(entry?.text()).toContain('账户中心')
  })

  it('unified event log records pageChange for internal navigation', async () => {
    const wrapper = create()
    await button(wrapper, '体验工具 ↗').trigger('click')
    await button(wrapper, '用户中心预览').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.get('[data-page="profile"]').trigger('click')
    await flushPromises()
    const host = await hostPanel(wrapper)
    const entry = host
      .findAll('[data-event-log] li')
      .find((item) => item.text().includes('pageChange'))
    expect(entry?.text()).toContain('个人资料')
  })

  it('messages override and brand prop reshape the auth card and header', async () => {
    const wrapper = create()
    const host = await hostPanel(wrapper)
    const messagesLabel = host
      .findAll('label')
      .find((item) => item.text().includes('注入 messages'))!
    await messagesLabel.get('input[type="checkbox"]').setValue(true)
    const brandLabel = host.findAll('label').find((item) => item.text().includes('品牌名'))!
    await brandLabel.get('input').setValue('Acme')
    expect(wrapper.find('main').text()).toContain('登录你的 Nova 演示账户')
    expect(wrapper.findAll('button').some((item) => item.text() === '进入演示')).toBe(true)
    expect(wrapper.find('header').text()).toContain('Acme.')
  })
})
