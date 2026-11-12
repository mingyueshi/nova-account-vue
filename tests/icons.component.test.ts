// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { Camera } from '@lucide/vue'
import { NovaIcon, NOVA_ICON_NAMES } from '../src'
import IconGallery from '../demo/IconGallery.vue'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function gallery() {
  const wrapper = mount(IconGallery, { props: { appearance: { mode: 'light', accent: 'blue' } } })
  wrappers.push(wrapper)
  return wrapper
}

describe('public Lucide icon adapter', () => {
  it('renders decorative and labelled SVG with size, stroke and color controls', async () => {
    const wrapper = mount(NovaIcon, { props: { name: 'custom:security' } })
    wrappers.push(wrapper)
    expect(NOVA_ICON_NAMES).toContain('security')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    await wrapper.setProps({
      size: 32,
      strokeWidth: 2.5,
      color: '#123456',
      label: 'Account security',
    })
    const svg = wrapper.get('svg')
    expect(svg.attributes()).toMatchObject({
      width: '32',
      height: '32',
      'stroke-width': '2.5',
      stroke: '#123456',
      role: 'img',
      'aria-label': 'Account security',
      focusable: 'false',
    })
    expect(svg.attributes('aria-hidden')).toBeUndefined()
    await wrapper.setProps({ icon: Camera })
    expect(wrapper.get('svg').classes()).toContain('lucide-camera')
  })
  it('handles unknown and inherited names with a labelled fallback', () => {
    const wrapper = mount(NovaIcon, {
      props: { name: 'toString', fallback: '?', label: 'Unknown icon' },
    })
    wrappers.push(wrapper)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.get('[role="img"]').text()).toBe('?')
  })
})

describe('icon workspace', () => {
  it('filters by category and Chinese/English names, then resets an empty result', async () => {
    const wrapper = gallery()
    expect(wrapper.findAll('.demo-icon-grid > button')).toHaveLength(55)
    await wrapper.get('input[type="search"]').setValue('相机')
    expect(wrapper.findAll('.demo-icon-grid > button')).toHaveLength(1)
    await wrapper.get('[aria-label="选择图标 相机 Camera"]').trigger('click')
    expect(wrapper.get('.demo-icon-inspector h2').text()).toBe('Camera')
    expect(wrapper.get('.demo-icon-code').text()).toContain(':icon="Camera"')
    await wrapper.get('input[type="search"]').setValue('no-such-icon')
    expect(wrapper.text()).toContain('没有找到匹配的图标')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '清空筛选')!
      .trigger('click')
    await wrapper
      .findAll('.demo-icon-categories button')
      .find((button) => button.text() === '账户与安全')!
      .trigger('click')
    expect(wrapper.findAll('.demo-icon-grid > button')).toHaveLength(8)
    await wrapper.get('input[type="search"]').setValue('shield')
    expect(wrapper.findAll('.demo-icon-grid > button')).toHaveLength(1)
  })
  it('copies the configured component and standalone SVG, and explains clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = gallery()
    const selects = wrapper.findAll('.demo-icon-controls select')
    await selects[0]!.setValue('48')
    await selects[1]!.setValue('2.5')
    await selects[2]!.setValue('var(--na-muted)')
    const svg = wrapper.get('.demo-icon-live svg')
    expect(svg.attributes('width')).toBe('48')
    expect(svg.attributes('stroke-width')).toBe('2.5')
    expect(wrapper.get('.demo-icon-code').text()).toContain('color="var(--na-muted)"')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '复制用法')!
      .trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('NovaIcon name="profile"'))
    expect(wrapper.get('[role="status"]').text()).toBe('用法代码已复制。')
    await selects[3]!.setValue('lucide')
    expect(wrapper.get('.demo-icon-code').text()).toContain(
      "import { UserRound } from '@lucide/vue'",
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '复制 SVG')!
      .trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining('xmlns="http://www.w3.org/2000/svg"'),
    )
    writeText.mockRejectedValueOnce(new Error('Denied'))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '复制用法')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('请选择下方代码后复制')
  })
})
