import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useAuthFlow } from '../src/composables/useAuthFlow'
import { useAppearance } from '../src/composables/useAppearance'
import NovaTheme from '../src/components/NovaTheme.vue'
import { createDemoAuthAdapter } from '../demo/auth'
import type { Appearance } from '../src/types'

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('reports restored appearance once to the controlled host without writing storage', async () => {
  localStorage.setItem('appearance-test', JSON.stringify({ mode: 'dark', accent: 'teal' }))
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const value = ref<Appearance>({ mode: 'light', accent: 'blue' })
  const changed = vi.fn((appearance: Appearance) => {
    value.value = appearance
  })
  const wrapper = mount({
    render: () =>
      h(NovaTheme, {
        modelValue: value.value,
        storageKey: 'appearance-test',
        'onUpdate:modelValue': changed,
      }),
  })
  try {
    await nextTick()
    expect(value.value).toEqual({ mode: 'dark', accent: 'teal' })
    expect(changed).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
    value.value = { mode: 'light', accent: 'rose' }
    await nextTick()
    expect(changed).toHaveBeenCalledOnce()
    expect(wrapper.get('.nova-account').attributes('data-accent')).toBe('rose')
  } finally {
    wrapper.unmount()
  }
})

it('runs countdowns in a store-like scope, resyncs visibility and disposes timers and credentials', async () => {
  vi.useFakeTimers()
  const adapter = createDemoAuthAdapter({ delay: () => Promise.resolve() })
  adapter.sendCode = vi.fn(async () => ({ expiresAt: Date.now() + 3000, retryAfter: 3 }))
  const remove = vi.spyOn(document, 'removeEventListener')
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  const scope = effectScope()
  try {
    const flow = scope.run(() => useAuthFlow(adapter))!
    flow.mode.value = 'code'
    flow.fill({ email: 'demo@demo.com' })
    await flow.requestCode()
    await flow.verifyChallenge({ value: 100 })
    expect(flow.resendSeconds.value).toBe(3)
    await vi.advanceTimersByTimeAsync(1000)
    expect(flow.resendSeconds.value).toBe(2)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(3000)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(flow.resendSeconds.value).toBe(0)
    expect(flow.codeExpired.value).toBe(true)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(flow.fields.email).toBe('')
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  } finally {
    scope.stop()
  }
})

it('restores a store-scoped appearance and removes its system listener on disposal', () => {
  const remove = vi.fn()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(
      () =>
        ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: remove,
        }) as unknown as MediaQueryList,
    ),
  )
  const scope = effectScope()
  try {
    const theme = scope.run(() => useAppearance({ initial: { mode: 'system', accent: 'blue' } }))!
    expect(theme.resolvedMode.value).toBe('dark')
    scope.stop()
    expect(remove).toHaveBeenCalledOnce()
  } finally {
    scope.stop()
  }
})

it('rejects unscoped lifecycle composables explicitly instead of leaving frozen clocks', () => {
  expect(() => useAuthFlow(createDemoAuthAdapter())).toThrow('active effectScope')
  expect(() => useAppearance()).toThrow('active effectScope')
})

it('keeps non-component SSR scopes free of browser timers and storage', () => {
  vi.useFakeTimers()
  vi.stubGlobal('document', undefined)
  vi.stubGlobal('window', undefined)
  const scope = effectScope()
  try {
    scope.run(() => {
      expect(useAuthFlow(createDemoAuthAdapter()).resendSeconds.value).toBe(0)
      expect(useAppearance().resolvedMode.value).toBe('light')
    })
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    scope.stop()
  }
})
