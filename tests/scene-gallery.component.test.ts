// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import App from '../demo/App.vue'
import SceneGallery from '../demo/SceneGallery.vue'

const wrappers: VueWrapper[] = []
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
function create(component: typeof App | typeof SceneGallery = SceneGallery) {
  const wrapper = mount(component, { attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}
async function scene(name: string) {
  const wrapper = create()
  await wrapper.setProps({ activeScene: name })
  return wrapper
}
function button(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('button').find((item) => item.text() === label)
  if (!found) throw new Error(`Missing button ${label}`)
  return found
}
/** NovaField renders label[for] + control; resolve the control by id. */
function fieldInput(wrapper: VueWrapper, label: string) {
  const labelEl = wrapper.findAll('label').find((item) => item.text() === label)
  if (!labelEl) throw new Error(`Missing field ${label}`)
  const id = labelEl.attributes('for')
  const input = wrapper.findAll('input,textarea').find((item) => item.attributes('id') === id)
  if (!input) throw new Error(`Missing control for ${label}`)
  return input
}

describe('scene gallery interactions', () => {
  it('coalesces observer widths outside delivery and cancels pending layout work on unmount', async () => {
    let notify!: ResizeObserverCallback
    const frames: FrameRequestCallback[] = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          notify = callback
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return 23
    })
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
    const wrapper = await scene('tasks')
    const resize = (width: number) =>
      notify([{ contentRect: { width } }] as ResizeObserverEntry[], {} as ResizeObserver)
    resize(1200)
    await flushPromises()
    expect(wrapper.find('.demo-task-detail').exists()).toBe(false)
    frames.shift()!(0)
    await flushPromises()
    expect(wrapper.find('.demo-task-detail').exists()).toBe(true)
    resize(1200)
    expect(raf).toHaveBeenCalledTimes(1)
    resize(800)
    resize(1200)
    expect(raf).toHaveBeenCalledTimes(2)
    frames.shift()!(0)
    await flushPromises()
    expect(wrapper.find('.demo-task-detail').exists()).toBe(true)
    resize(800)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(cancel).toHaveBeenCalledWith(23)
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('edits compact task details, returns focus and preserves fields through delete/undo', async () => {
    const wrapper = await scene('tasks')
    const open = () => wrapper.get('[aria-label="查看任务 核对发票"]')
    await wrapper.get('[aria-label="任务状态筛选"]').findAll('button')[1]!.trigger('click')
    await open().trigger('click')
    await flushPromises()
    await fieldInput(wrapper, '任务备注').setValue('带上需要核对的资料')
    await fieldInput(wrapper, '计划日期').setValue('2026-12-01')
    await wrapper.get('dialog[open] select').setValue('high')
    await button(wrapper, '标记为完成').trigger('click')
    expect(wrapper.get('dialog[open] [role=status]').text()).toBe('已完成')
    await button(wrapper, '关闭').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('.demo-inline-notice').element)
    await wrapper.get('[aria-label="任务状态筛选"]').findAll('button')[0]!.trigger('click')
    await wrapper.get('[aria-label="删除任务 核对发票"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('.demo-inline-notice').element)
    await button(wrapper, '撤销删除').trigger('click')
    await open().trigger('click')
    expect((fieldInput(wrapper, '任务备注').element as HTMLTextAreaElement).value).toBe(
      '带上需要核对的资料',
    )
    expect((fieldInput(wrapper, '计划日期').element as HTMLInputElement).value).toBe('2026-12-01')
    expect(wrapper.get<HTMLSelectElement>('dialog[open] select').element.value).toBe('high')
    await wrapper.setProps({ activeScene: 'editor' })
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
  })

  it('keeps a cancelled comment draft and never steals focus after leaving during publish', async () => {
    const wrapper = await scene('comments')
    const trigger = wrapper.get('.demo-community-compose-trigger')
    await trigger.trigger('click')
    await fieldInput(wrapper, '发表评论').setValue('记录日常的小小进步')
    await button(wrapper, '取消').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(trigger.element)
    expect(trigger.text()).toContain('继续编辑')
    await trigger.trigger('click')
    expect((fieldInput(wrapper, '发表评论').element as HTMLTextAreaElement).value).toBe(
      '记录日常的小小进步',
    )
    await wrapper.get('form[aria-label="发布评论"]').trigger('submit')
    await wrapper.setProps({ activeScene: 'tasks' })
    const input = fieldInput(wrapper, '新任务')
    ;(input.element as HTMLInputElement).focus()
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.get('.demo-scene-comment').text()).toContain('记录日常的小小进步')
    expect(document.activeElement).toBe(input.element)
  })

  it('restores order feedback when payment removes the filtered trigger', async () => {
    const wrapper = await scene('orders')
    await wrapper.get('[aria-label="订单状态筛选"]').findAll('button')[1]!.trigger('click')
    const trigger = wrapper.get('[data-order-id="NO-2026-0817"]')
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('click')
    await flushPromises()
    const pay = button(wrapper, '确认支付')
    ;(pay.element as HTMLButtonElement).focus()
    await pay.trigger('click')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    expect(wrapper.get('.nova-dialog-footer').text()).not.toContain('确认支付')
    expect(wrapper.get('dialog[open] .nova-dialog-footer').text()).toContain('¥228.00')
    expect(document.activeElement).toBe(wrapper.get('dialog[open] [role=status]').element)
    await button(wrapper, '关闭').trigger('click')
    await flushPromises()
    expect(trigger.element.isConnected).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.demo-order-notice').element)
  })

  it('task list validates, adds, searches, completes and empties', async () => {
    const wrapper = create()
    const form = wrapper.get('form[aria-label="任务添加"]')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('请输入任务内容。')
    await fieldInput(wrapper, '新任务').setValue('写周报')
    await form.trigger('submit')
    expect(wrapper.find('form[aria-label="任务添加"]').text()).not.toContain('请输入任务内容。')
    expect(wrapper.text()).toContain('写周报')
    expect(wrapper.text()).toContain('进行中 3 · 已完成 1')
    // Search narrows the visible rows.
    await fieldInput(wrapper, '搜索任务').setValue('周报')
    expect(wrapper.text()).not.toContain('核对发票')
    expect(wrapper.text()).toContain('写周报')
    await fieldInput(wrapper, '搜索任务').setValue('')
    // Complete the new task via its row checkbox, then clear it with the done filter.
    const checkbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((item) => item.element.closest('label')?.textContent?.includes('写周报'))!
    await checkbox.setValue(true)
    expect(wrapper.text()).toContain('进行中 2 · 已完成 2')
    await wrapper
      .findAll('button')
      .find((item) => item.text().startsWith('已完成'))!
      .trigger('click')
    expect(wrapper.text()).toContain('回复客户邮件')
    expect(wrapper.text()).toContain('写周报')
    const doneRow = wrapper
      .findAll('li.demo-scene-item')
      .find((item) => item.text().includes('写周报'))!
    await doneRow.get('button[aria-label^="删除任务 "]').trigger('click')
    expect(wrapper.get('.demo-task-list').text()).not.toContain('写周报')
    await button(wrapper, '撤销删除').trigger('click')
    expect(wrapper.get('.demo-task-list').text()).toContain('写周报')
  })

  it('editor validates, previews and saves with a busy state', async () => {
    const wrapper = await scene('editor')
    const form = wrapper.get('form[aria-label="保存文章"]')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('标题不能为空。')
    expect(wrapper.text()).toContain('正文不能为空。')
    await fieldInput(wrapper, '文章标题').setValue('接入笔记')
    await fieldInput(wrapper, '正文').setValue('第一段内容。')
    expect(wrapper.text()).toContain('已输入 6/5000 字符')
    await button(wrapper, '预览').trigger('click')
    const preview = wrapper.get('.demo-scene-preview')
    expect(preview.text()).toContain('接入笔记')
    expect(preview.text()).toContain('第一段内容。')
    expect(button(wrapper, '预览').attributes('aria-pressed')).toBe('true')
    expect(button(wrapper, '预览').attributes('aria-controls')).toBe(
      wrapper.get('dialog[open]').attributes('id'),
    )
    await button(wrapper, '继续编辑').trigger('click')
    await form.trigger('submit')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()
    expect(wrapper.find('[role="status"]').text()).toContain('草稿《接入笔记》已保存')
    await button(wrapper, '清空').trigger('click')
    expect(wrapper.get('dialog[open]').text()).toContain('清空这篇草稿？')
    await button(wrapper, '保留草稿').trigger('click')
    expect((fieldInput(wrapper, '文章标题').element as HTMLInputElement).value).toBe('接入笔记')
    await button(wrapper, '清空').trigger('click')
    await button(wrapper, '清空内容').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(fieldInput(wrapper, '文章标题').element)
    expect(wrapper.find('.demo-scene-preview').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('keeps edits made while saving distinct from the saved snapshot', async () => {
    const wrapper = await scene('editor')
    await fieldInput(wrapper, '文章标题').setValue('第一版标题')
    await fieldInput(wrapper, '正文').setValue('第一版正文')
    await wrapper.get('form[aria-label="保存文章"]').trigger('submit')
    await fieldInput(wrapper, '文章标题').setValue('第二版标题')
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper.get('.demo-draft-state').text()).toContain('有未保存的修改')
    expect(wrapper.find('.demo-success-note').exists()).toBe(false)
    await wrapper.get('form[aria-label="保存文章"]').trigger('submit')
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper.get('.demo-draft-state').text()).toContain('已保存')
    expect(wrapper.get('.demo-success-note').text()).toContain('第二版标题')
  })

  it('reveals newly added tasks when a previous search and completion filter exclude them', async () => {
    const wrapper = create()
    await fieldInput(wrapper, '搜索任务').setValue('不存在的词')
    await wrapper.get('[aria-label="任务状态筛选"]').findAll('button')[2]!.trigger('click')
    await fieldInput(wrapper, '新任务').setValue('下一步')
    await wrapper.get('form[aria-label="任务添加"]').trigger('submit')
    expect(wrapper.get('.demo-task-list').text()).toContain('下一步')
    expect((fieldInput(wrapper, '搜索任务').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('[aria-label="任务状态筛选"] button').attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('comments validate, publish newest-first and toggle likes', async () => {
    const wrapper = await scene('comments')
    await wrapper.get('.demo-community-compose-trigger').trigger('click')
    const form = wrapper.get('form[aria-label="发布评论"]')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('评论内容不能为空。')
    await fieldInput(wrapper, '发表评论').setValue('很实用的组合演示')
    // The field error persists until the next submit; the hint returns after success.
    await form.trigger('submit')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.get('.demo-community-compose-trigger').text()).toContain('写评论')
    const firstComment = wrapper.get('.demo-scene-comment')
    expect(firstComment.text()).toContain('你')
    expect(firstComment.text()).toContain('刚刚')
    expect(firstComment.text()).toContain('很实用的组合演示')
    expect(wrapper.text()).toContain('4 条评论')
    const like = firstComment.get('button.demo-like-button')
    await like.trigger('click')
    expect(like.text()).toBe('赞 1')
    expect(like.attributes('aria-pressed')).toBe('true')
    await like.trigger('click')
    expect(like.text()).toBe('赞 0')
    expect(like.attributes('aria-pressed')).toBe('false')
  })

  it('orders filter, open a detail dialog and simulate payment', async () => {
    const wrapper = await scene('orders')
    await wrapper
      .findAll('button')
      .find((item) => item.text().startsWith('待支付'))!
      .trigger('click')
    expect(wrapper.text()).toContain('NO-2026-0817')
    expect(wrapper.text()).not.toContain('NO-2026-0802')
    await wrapper
      .findAll('button')
      .find((item) => item.attributes('data-order-id') === 'NO-2026-0817')!
      .trigger('click')
    const dialog = wrapper.get('dialog[open]')
    expect(dialog.get('h2').text()).toBe('订单详情')
    expect(dialog.text()).toContain('订单号 NO-2026-0817')
    expect(dialog.text()).toContain('显示器支架')
    expect(dialog.text()).toContain('¥228.00')
    await dialog
      .findAll('button')
      .find((item) => item.text() === '确认支付')!
      .trigger('click')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    expect(dialog.text()).toContain('支付成功，订单等待发货。')
    expect(dialog.text()).toContain('待发货')
    await dialog
      .findAll('button')
      .find((item) => item.text() === '关闭')!
      .trigger('click')
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    // The only pending order was paid: the pending filter is now empty.
    await wrapper
      .findAll('button')
      .find((item) => item.text().startsWith('待支付'))!
      .trigger('click')
    expect(wrapper.text()).toContain('该状态下暂无订单。')
  })

  it('isolates payment progress and receipts when another order is opened', async () => {
    const wrapper = await scene('orders')
    await wrapper.get('[data-order-id="NO-2026-0817"]').trigger('click')
    await button(wrapper, '确认支付').trigger('click')
    await wrapper
      .get('dialog[open]')
      .findAll('button')
      .find((item) => item.text() === '关闭')!
      .trigger('click')
    await wrapper.get('[data-order-id="NO-2026-0802"]').trigger('click')
    await vi.advanceTimersByTimeAsync(800)
    expect(wrapper.get('dialog[open]').text()).not.toContain('模拟支付完成')
    expect(wrapper.get('dialog[open]').text()).toContain('机械键盘')
    await wrapper
      .get('dialog[open]')
      .findAll('button')
      .find((item) => item.text() === '关闭')!
      .trigger('click')
    await wrapper.get('[data-order-id="NO-2026-0817"]').trigger('click')
    expect(wrapper.get('dialog[open]').text()).toContain('待发货')
    expect(wrapper.get('dialog[open]').text()).toContain('支付成功，订单等待发货。')
    expect(wrapper.get('dialog[open]').find('[aria-busy]').exists()).toBe(false)
  })

  it('App opens business content within the account shell', async () => {
    const wrapper = create(App)
    await wrapper.get('input[autocomplete="email"]').setValue('demo@demo.com')
    await wrapper.get('input[autocomplete="current-password"]').setValue('123456')
    await wrapper.get('form').trigger('submit')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.get('input[type="range"]').setValue(100)
    await wrapper.get('input[type="range"]').trigger('keydown', { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(1200)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.get('[data-page="custom:tasks"]').trigger('click')
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(wrapper.find('.demo-scenes').exists()).toBe(true)
    expect(wrapper.get('[aria-label="任务清单"] h2').text()).toBe('任务清单')
    expect(wrapper.find('.demo-single').isVisible()).toBe(true)
    expect(wrapper.get('h1').text()).toBe('我的任务')
    await wrapper.get('[data-page="overview"]').trigger('click')
    expect(wrapper.get('.demo-scenes').isVisible()).toBe(false)
    expect(wrapper.find('.demo-single').isVisible()).toBe(true)
  })
})
