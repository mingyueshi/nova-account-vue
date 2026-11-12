// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ProfileSlotEditor from '../demo/ProfileSlotEditor.vue'
import type { AccountAdapter, AccountSnapshot } from '../src'

const wrappers: VueWrapper[] = []
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})
const snapshot = {
  revision: '5',
  profile: { id: 'u1', nickname: 'Nova', bio: '简介', avatar: 'iris', avatarUrl: '' },
} as unknown as AccountSnapshot

function create() {
  const adapter = {
    updateProfile: vi.fn(async () => snapshot),
    uploadAvatar: vi.fn(async () => snapshot),
  } as unknown as AccountAdapter
  const refresh = vi.fn(async () => snapshot)
  const wrapper = mount(ProfileSlotEditor, {
    props: { snapshot, adapter, refresh },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return { wrapper, adapter, refresh }
}
function fieldInput(wrapper: VueWrapper, label: string) {
  const labelEl = wrapper.findAll('label').find((item) => item.text() === label)
  if (!labelEl) throw new Error(`Missing field ${label}`)
  const id = labelEl.attributes('for')
  const input = wrapper.findAll('input,textarea').find((item) => item.attributes('id') === id)
  if (!input) throw new Error(`Missing control for ${label}`)
  return input
}

describe('profile slot editor', () => {
  it('validates core and extended fields, saves through the adapter and tracks dirtiness', async () => {
    const { wrapper, adapter, refresh } = create()
    const form = wrapper.get('form')
    // Core: empty nickname blocks the save.
    await fieldInput(wrapper, '展示昵称').setValue('')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('昵称不能为空。')
    expect(adapter.updateProfile).not.toHaveBeenCalled()
    // Extended: an invalid phone also blocks the save.
    await fieldInput(wrapper, '展示昵称').setValue('示例用户')
    await fieldInput(wrapper, '联系电话').setValue('123')
    await form.trigger('submit')
    expect(wrapper.text()).toContain('手机号格式应为 1 开头的 11 位数字。')
    expect(wrapper.text()).toContain('有未保存的更改')
    // Valid save flows through updateProfile + refresh.
    await fieldInput(wrapper, '联系电话').setValue('13900000000')
    await form.trigger('submit')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(adapter.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: '示例用户', bio: '简介', avatar: 'iris', avatarUrl: '' }),
      expect.objectContaining({ revision: '5' }),
    )
    expect(refresh).toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').text()).toContain('核心资料已通过适配器保存')
    // Reset returns to the snapshot values.
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '还原')!
      .trigger('click')
    expect((fieldInput(wrapper, '展示昵称').element as HTMLInputElement).value).toBe('Nova')
  })

  it('manages tags with duplicate and limit errors', async () => {
    const { wrapper } = create()
    const scene = wrapper
    const add = () =>
      scene
        .findAll('button')
        .find((item) => item.text() === '添加标签')!
        .trigger('click')
    const tagInput = scene.get('input[aria-label="新标签名称"]')
    await tagInput.setValue('')
    await add()
    expect(scene.text()).toContain('标签不能为空。')
    await tagInput.setValue('演示')
    await add()
    expect(scene.text()).toContain('标签已存在。')
    for (const tag of ['前端', '设计', '管理']) {
      await tagInput.setValue(tag)
      await add()
    }
    expect(scene.findAll('.demo-scene-tag')).toHaveLength(5)
    await tagInput.setValue('超出')
    await add()
    expect(scene.text()).toContain('最多 5 个标签。')
    await scene.get('button[aria-label="移除标签 前端"]').trigger('click')
    expect(scene.findAll('.demo-scene-tag')).toHaveLength(4)
  })
})
