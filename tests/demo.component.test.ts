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
