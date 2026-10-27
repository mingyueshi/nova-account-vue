import { describe, expect, it, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { parseAppearance, useAppearance } from '../src/composables/useAppearance'
import NovaTheme from '../src/components/NovaTheme.vue'
import NovaAppearance from '../src/components/NovaAppearance.vue'
import type { Appearance } from '../src/types'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })
describe('strict appearance and instance-scoped theme', () => {
  it('controlled v-model updates are silent and user changes emit exactly once', async () => {
    const value = ref<Appearance>({ mode: 'light', accent: 'iris' })
    const updates = vi.fn((next: Appearance) => { value.value = next })
    const wrapper = mount(defineComponent({ setup() { return () => h(NovaTheme, { modelValue: value.value, 'onUpdate:modelValue': updates }, { default: ({ setAppearance }: { setAppearance: (value: Appearance) => void }) => h('button', { onClick: () => setAppearance({ mode: 'dark', accent: 'blue' }) }, 'change') }) } }))
    value.value = { mode: 'dark', accent: 'amber' }
    await nextTick(); await nextTick()
    expect(updates).not.toHaveBeenCalled()
    await wrapper.find('button').trigger('click'); await nextTick(); await nextTick()
    expect(updates).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.nova-account').attributes('data-accent')).toBe('blue')
    wrapper.unmount()
  })
  it('accepts exactly two valid fields only', () => {
    expect(parseAppearance({ mode: 'system', accent: 'iris' })).toEqual({ mode: 'system', accent: 'iris' })
    for (const value of [null, [], {}, { mode: 'system' }, { mode: 'light', accent: 'red' }, { mode: 'unknown', accent: 'iris' }, { mode: 'light', accent: 'iris', email: 'secret' }]) expect(parseAppearance(value)).toBeNull()
  })
  it('does not persist by default; updates only its own root', async () => {
    const one = mount(NovaTheme, { props: { modelValue: { mode: 'dark', accent: 'blue' } } })
    const two = mount(NovaTheme)
    expect(one.attributes('data-theme')).toBe('dark')
    expect(two.attributes('data-theme')).toBe('light')
    await one.setProps({ modelValue: { mode: 'light', accent: 'amber' } })
    expect(one.attributes('data-accent')).toBe('amber')
    expect(two.attributes('data-accent')).toBe('iris')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.length).toBe(0)
    one.unmount(); two.unmount()
  })
  it('writes only validated mode/accent and only on user update', () => {
    let theme!: ReturnType<typeof useAppearance>
    const Host = defineComponent({ setup() { theme = useAppearance({ storageKey: 'test-theme' }); return () => h('div') } })
    const wrapper = mount(Host)
    expect(localStorage.length).toBe(0)
    theme.setAppearance({ mode: 'dark', accent: 'teal' })
    expect(JSON.parse(localStorage.getItem('test-theme')!)).toEqual({ mode: 'dark', accent: 'teal' })
    theme.setAppearance({ mode: 'light', accent: 'iris', password: 'not-stored' } as Appearance)
    expect(localStorage.getItem('test-theme')).not.toContain('password')
    wrapper.unmount()
  })
  it('rejects malformed persisted data and tolerates denied storage', () => {
    localStorage.setItem('test-theme', '{"mode":"dark","accent":"iris","password":"no"}')
    const wrapper = mount(NovaTheme, { props: { storageKey: 'test-theme' } })
    expect(wrapper.attributes('data-theme')).toBe('light'); wrapper.unmount()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied') })
    let theme!: ReturnType<typeof useAppearance>
    const host = mount(defineComponent({ setup() { theme = useAppearance({ storageKey: 'test-theme' }); return () => h('div') } }))
    expect(theme.storageError.value).toContain('无法保存')
    theme.setAppearance({ mode: 'dark', accent: 'iris' })
    expect(theme.appearance.value.mode).toBe('dark'); host.unmount()
  })
  it('tracks system changes and removes the media listener', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined
    const remove = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: (_: string, callback: typeof listener) => { listener = callback }, removeEventListener: remove })))
    let theme!: ReturnType<typeof useAppearance>
    const wrapper = mount(defineComponent({ setup() { theme = useAppearance({ initial: { mode: 'system', accent: 'iris' } }); return () => h('div') } }))
    expect(theme.resolvedMode.value).toBe('dark')
    listener?.({ matches: false } as MediaQueryListEvent)
    expect(theme.resolvedMode.value).toBe('light')
    expect(localStorage.length).toBe(0)
    wrapper.unmount(); expect(remove).toHaveBeenCalled(); vi.unstubAllGlobals()
  })
  it('all modes and named accents expose pressed state and emit typed selections', async () => {
    const wrapper = mount(NovaAppearance, { props: { modelValue: { mode: 'light', accent: 'iris' } } })
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(2)
    const blue = wrapper.findAll('button').find(button => button.text().includes('晴空蓝'))!
    await blue.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ mode: 'light', accent: 'blue' }])
    wrapper.unmount()
  })
})
