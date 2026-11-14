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
  localStorage.clear()
})
function create(component: typeof App | typeof SceneGallery = SceneGallery) {
  const wrapper = mount(component, { attachTo: document.body })
  wrappers.push(wrapper)
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
    const wrapper = create()
    const form = wrapper.get('form[aria-label="保存文章"]')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('标题不能为空。')
    expect(wrapper.text()).toContain('正文不能为空。')
    await fieldInput(wrapper, '文章标题').setValue('接入笔记')
    await fieldInput(wrapper, '正文').setValue('第一段内容。')
    expect(wrapper.text()).toContain('已输入 6/200 字符')
    await button(wrapper, '预览').trigger('click')
    const preview = wrapper.get('.demo-scene-preview')
    expect(preview.text()).toContain('接入笔记')
    expect(preview.text()).toContain('第一段内容。')
    expect(button(wrapper, '预览').attributes('aria-pressed')).toBe('true')
    expect(button(wrapper, '预览').attributes('aria-controls')).toBe(preview.attributes('id'))
    await form.trigger('submit')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()
    expect(wrapper.find('[role="status"]').text()).toContain('已保存《接入笔记》到内存')
    await button(wrapper, '清空').trigger('click')
    expect(wrapper.find('.demo-scene-preview').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('keeps edits made while saving distinct from the saved snapshot', async () => {
    const wrapper = create()
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
    const wrapper = create()
    const form = wrapper.get('form[aria-label="发布评论"]')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('评论内容不能为空。')
    await fieldInput(wrapper, '发表评论').setValue('很实用的组合演示')
    // The field error persists until the next submit; the hint returns after success.
    await form.trigger('submit')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()
    expect(wrapper.text()).toContain('已输入 0/120 字符')
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
    const wrapper = create()
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
    expect(dialog.text()).toContain('订单详情 NO-2026-0817')
    expect(dialog.text()).toContain('显示器支架')
    expect(dialog.text()).toContain('¥228.00')
    await dialog
      .findAll('button')
      .find((item) => item.text() === '模拟支付')!
      .trigger('click')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    expect(dialog.text()).toContain('模拟支付完成，订单等待发货。')
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
    const wrapper = create()
    await wrapper.get('[data-order-id="NO-2026-0817"]').trigger('click')
    await button(wrapper, '模拟支付').trigger('click')
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
    expect(wrapper.get('dialog[open]').text()).toContain('模拟支付完成，订单等待发货。')
    expect(wrapper.get('dialog[open]').find('[aria-busy]').exists()).toBe(false)
  })

  it('App opens business content within the account shell', async () => {
    const wrapper = create(App)
    await button(wrapper, '用户中心预览').trigger('click')
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
