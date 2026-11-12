// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { init } from 'echarts/core'
import NovaChart from '../src/components/NovaChart.vue'
import ChartGallery from '../demo/ChartGallery.vue'
import { chartCsv, createActivityRows } from '../demo/charts/data'

const engine = vi.hoisted(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }))
vi.mock('echarts/core', () => ({ use: vi.fn(), init: vi.fn(() => engine) }))
const wrappers: VueWrapper[] = []
let frames: FrameRequestCallback[] = []
let resize: () => void
let width = 800
const disconnect = vi.fn()
const removeMedia = vi.fn()
function paint() {
  const pending = frames
  frames = []
  pending.forEach((callback) => callback(0))
}
beforeEach(() => {
  frames = []
  width = 800
  vi.clearAllMocks()
  vi.mocked(init).mockReturnValue(engine as unknown as ReturnType<typeof init>)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = vi.fn()
      disconnect = disconnect
    },
  )
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: removeMedia,
  }))
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function chart() {
  const wrapper = mount(NovaChart, {
    props: {
      option: {
        xAxis: { type: 'category', data: ['Mon'] },
        yAxis: { type: 'value' },
        legend: {},
        tooltip: { trigger: 'axis' },
        series: [{ type: 'line', data: [3] }],
      },
      label: 'Activity',
      description: 'Monday 3 events',
    },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}
function gallery() {
  const wrapper = mount(ChartGallery, {
    props: { appearance: { mode: 'light', accent: 'blue' }, active: true },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find((item) => item.text() === label)!
}

describe('optional chart adapter', () => {
  it('waits for measurable content, updates data and disposes observers and engine', async () => {
    width = 0
    const wrapper = chart()
    paint()
    expect(init).not.toHaveBeenCalled()
    width = 800
    resize()
    paint()
    expect(init).toHaveBeenCalledOnce()
    expect(wrapper.attributes('aria-label')).toBe('Activity。Monday 3 events')
    expect(engine.setOption.mock.calls.at(-1)![0]).toMatchObject({
      animation: true,
      tooltip: { renderMode: 'richText', confine: true },
      xAxis: [{ axisLabel: { hideOverlap: true } }],
    })
    await wrapper.setProps({ option: { series: [{ type: 'bar', data: [9] }] } })
    paint()
    expect(engine.setOption.mock.calls.at(-1)![0].series[0].data).toEqual([9])
    await wrapper.setProps({ active: false })
    paint()
    const calls = engine.setOption.mock.calls.length
    window.dispatchEvent(new Event('resize'))
    paint()
    expect(engine.setOption).toHaveBeenCalledTimes(calls)
    await wrapper.setProps({ active: true })
    paint()
    expect(engine.setOption).toHaveBeenCalledTimes(calls + 1)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(engine.dispose).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(removeMedia).toHaveBeenCalled()
  })
  it('reads scoped theme tokens and disables chart animation for reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const host = document.createElement('div')
    host.className = 'nova-account'
    document.body.append(host)
    const wrapper = mount(NovaChart, {
      props: {
        option: { series: [{ type: 'pie', data: [{ name: 'Done', value: 3 }] }] },
        label: 'Composition',
      },
      attachTo: host,
    })
    wrappers.push(wrapper)
    wrapper.element.setAttribute('style', '--na-brand: #123456; --na-ink: #111111')
    paint()
    expect(engine.setOption.mock.calls.at(-1)![0]).toMatchObject({
      color: ['#123456', expect.any(String), expect.any(String), expect.any(String)],
      animation: false,
    })
    host.setAttribute('data-theme', 'dark')
    await flushPromises()
    paint()
    expect(engine.setOption).toHaveBeenCalledTimes(2)
    host.remove()
  })
  it('exposes a host-labelled failure and retries on the next update', async () => {
    vi.mocked(init).mockImplementationOnce(() => {
      throw new Error('Renderer failed')
    })
    const wrapper = chart()
    paint()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Chart unavailable')
    expect(wrapper.emitted('error')).toEqual([['Renderer failed']])
    await wrapper.setProps({ themeKey: 'retry' })
    paint()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('ready')).toHaveLength(1)
  })
})

describe('dynamic account chart workspace', () => {
  it('uses the same filtered records for summaries, charts and CSV', async () => {
    const wrapper = gallery()
    paint()
    expect(createActivityRows(7)).toHaveLength(7)
    expect(chartCsv(createActivityRows(7), 'activity').split('\r\n')).toHaveLength(8)
    await wrapper.get('select[aria-label="图表时间范围"]').setValue('30')
    expect(wrapper.findAll('tbody tr')).toHaveLength(30)
    await button(wrapper, '订单变化').trigger('click')
    expect(wrapper.get('thead').text()).toContain('支付订单')
    const total = createActivityRows(30).reduce((sum, row) => sum + row.paid, 0)
    expect(wrapper.get('.demo-chart-summary').text()).toContain(String(total))
    await wrapper.get('select[aria-label="图表数据状态"]').setValue('zero')
    expect(wrapper.get('.demo-chart-ring-empty').text()).toContain('当前数值均为 0')
    await wrapper.get('select[aria-label="图表数据状态"]').setValue('empty')
    expect(wrapper.text()).toContain('当前范围内没有数据')
    await button(wrapper, '查看示例数据').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(30)
  })
  it('advances only on explicit playback, pauses when leaving, and restores hidden series', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const wrapper = gallery()
    paint()
    const first = wrapper.get('tbody tr').text()
    await button(wrapper, '开始回放').trigger('click')
    await vi.advanceTimersByTimeAsync(1800)
    expect(wrapper.get('tbody tr').text()).not.toBe(first)
    await wrapper.setProps({ active: false })
    const paused = wrapper.get('tbody tr').text()
    await vi.advanceTimersByTimeAsync(3600)
    expect(wrapper.get('tbody tr').text()).toBe(paused)
    expect(button(wrapper, '开始回放').exists()).toBe(true)
    await wrapper.setProps({ active: true })
    await button(wrapper, '重置').trigger('click')
    expect(wrapper.get('tbody tr').text()).toBe(first)
    for (const series of wrapper.findAll('.demo-chart-series button')) await series.trigger('click')
    expect(wrapper.text()).toContain('尚未选择数据系列')
    await button(wrapper, '显示全部系列').trigger('click')
    expect(wrapper.find('.demo-chart-empty').exists()).toBe(false)
  })
})
