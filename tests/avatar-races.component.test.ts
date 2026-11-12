// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import Center from '../src/components/NovaAccountCenter.vue'
import { createDemoAccountAdapter, createInitialAccount } from '../demo/account'
import type { AccountSnapshot, MutationContext } from '../src/types'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function setup() {
  const old = createInitialAccount(Date.now())
  old.profile.nickname = 'OLD_ACCOUNT'
  old.profile.avatarUrl = 'data:image/png;base64,AA=='
  const fresh = createInitialAccount(Date.now())
  fresh.profile.nickname = 'NEW_ACCOUNT'
  const pending = deferred<AccountSnapshot>()
  const upload = vi.fn(
    (_value: { dataUrl: string | null }, _context: MutationContext) => pending.promise,
  )
  const adapter = {
    ...createDemoAccountAdapter({ wait: () => Promise.resolve() }),
    load: async () => old,
    uploadAvatar: upload,
  }
  const replacement = {
    ...createDemoAccountAdapter({ wait: () => Promise.resolve() }),
    load: async () => fresh,
    uploadAvatar: vi.fn(async () => fresh),
  }
  const wrapper = mount(Center, { props: { adapter, initialPage: 'profile' } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, old, fresh, pending, upload, adapter, replacement }
}
function remove(wrapper: VueWrapper) {
  return wrapper.findAll('button').find((button) => button.text() === '移除头像')!
}
for (const outcome of ['success', 'failure'] as const) {
  it(`ignores late avatar ${outcome} after replacing the adapter`, async () => {
    const { wrapper, old, pending, upload, replacement } = await setup()
    await remove(wrapper).trigger('click')
    await wrapper.setProps({ adapter: replacement })
    await flushPromises()
    expect(upload.mock.calls[0]![1].signal.aborted).toBe(true)
    expect(wrapper.text()).toContain('NEW_ACCOUNT')
    if (outcome === 'success') pending.resolve(old)
    else pending.reject(new Error('OLD_ERROR'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('OLD_ACCOUNT')
    expect(wrapper.text()).not.toContain('OLD_ERROR')
    expect(wrapper.text()).not.toContain('头像已更新')
  })
}
it('serializes avatar and profile mutations and releases busy state after cancellation', async () => {
  const { wrapper, adapter, upload, pending, old } = await setup()
  const update = vi.spyOn(adapter, 'updateProfile')
  await wrapper.get('input[autocomplete="nickname"]').setValue('Draft')
  await remove(wrapper).trigger('click')
  await wrapper.get('main form').trigger('submit')
  expect(update).not.toHaveBeenCalled()
  expect(upload).toHaveBeenCalledTimes(1)
  pending.resolve(old)
  await flushPromises()
  expect((wrapper.get('input[autocomplete="nickname"]').element as HTMLInputElement).value).toBe(
    'Draft',
  )
  await wrapper.get('main form').trigger('submit')
  await flushPromises()
  expect(update).toHaveBeenCalledTimes(1)
})
it('aborts pending avatar requests on navigation and unmount', async () => {
  const { wrapper, upload, pending, old } = await setup()
  await remove(wrapper).trigger('click')
  await wrapper.get('[data-page="overview"]').trigger('click')
  expect(upload.mock.calls[0]![1].signal.aborted).toBe(true)
  pending.resolve(old)
  await flushPromises()
  expect(wrapper.text()).not.toContain('头像已更新')
  const second = await setup()
  await remove(second.wrapper).trigger('click')
  second.wrapper.unmount()
  expect(second.upload.mock.calls[0]![1].signal.aborted).toBe(true)
  second.pending.reject(new Error('UNMOUNTED_ERROR'))
  await flushPromises()
})
class DelayedReader {
  static LOADING = 1
  static instances: DelayedReader[] = []
  readyState = 1
  result = 'data:image/png;base64,AA=='
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  abort = vi.fn(() => {
    this.readyState = 2
    this.onabort?.()
  })
  readAsDataURL = vi.fn()
  constructor() {
    DelayedReader.instances.push(this)
  }
}
async function selectFile(wrapper: VueWrapper) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File(['x'], 'a.png', { type: 'image/png' })],
  })
  await input.trigger('change')
  return DelayedReader.instances.at(-1)!
}
it('cancels file reading before invoking either adapter and preserves a newer operation', async () => {
  vi.stubGlobal('FileReader', DelayedReader)
  const { wrapper, upload, replacement } = await setup()
  const first = await selectFile(wrapper)
  const staleLoad = first.onload!
  await wrapper.setProps({ adapter: replacement })
  await flushPromises()
  expect(first.abort).toHaveBeenCalledTimes(1)
  const second = await selectFile(wrapper)
  staleLoad()
  await flushPromises()
  expect(upload).not.toHaveBeenCalled()
  expect(replacement.uploadAvatar).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('上传中')
  second.onload!()
  await flushPromises()
  expect(replacement.uploadAvatar).toHaveBeenCalledTimes(1)
})
it('reports reader errors and allows retry without leaving the account busy', async () => {
  vi.stubGlobal('FileReader', DelayedReader)
  const { wrapper, upload } = await setup()
  const reader = await selectFile(wrapper)
  reader.onerror!()
  await flushPromises()
  expect(upload).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('读取')
  expect((wrapper.get('input[type="file"]').element as HTMLInputElement).disabled).toBe(false)
  await remove(wrapper).trigger('click')
  expect(upload).toHaveBeenCalledTimes(1)
})
it('does not let a stale upload completion release a newer avatar mutation', async () => {
  const { wrapper, old, pending, replacement, fresh } = await setup()
  const next = deferred<AccountSnapshot>()
  replacement.uploadAvatar.mockImplementation(() => next.promise)
  fresh.profile.avatarUrl = 'data:image/png;base64,AA=='
  await remove(wrapper).trigger('click')
  await wrapper.setProps({ adapter: replacement })
  await flushPromises()
  await remove(wrapper).trigger('click')
  pending.resolve(old)
  await flushPromises()
  expect(wrapper.text()).toContain('上传中')
  expect(wrapper.text()).not.toContain('OLD_ACCOUNT')
  next.resolve(fresh)
  await flushPromises()
  expect(wrapper.text()).not.toContain('上传中')
})
it('does not start an avatar operation while profile saving is pending', async () => {
  const { wrapper, adapter, upload, old } = await setup()
  const save = deferred<AccountSnapshot>()
  vi.spyOn(adapter, 'updateProfile').mockReturnValue(save.promise)
  await wrapper.get('input[autocomplete="nickname"]').setValue('Draft')
  await wrapper.get('main form').trigger('submit')
  await remove(wrapper).trigger('click')
  expect(upload).not.toHaveBeenCalled()
  save.resolve(old)
  await flushPromises()
})
it('aborts file reads on unmount without starting an upload', async () => {
  vi.stubGlobal('FileReader', DelayedReader)
  const { wrapper, upload } = await setup()
  const reader = await selectFile(wrapper)
  const late = reader.onload!
  wrapper.unmount()
  expect(reader.abort).toHaveBeenCalledTimes(1)
  late()
  await flushPromises()
  expect(upload).not.toHaveBeenCalled()
})
