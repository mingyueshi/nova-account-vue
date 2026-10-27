// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import NovaAuthForm from '../src/components/NovaAuthForm.vue'
import NovaTheme from '../src/components/NovaTheme.vue'
import NovaButton from '../src/components/NovaButton.vue'
import NovaAccountCenter from '../src/components/NovaAccountCenter.vue'
import { useAuthFlow } from '../src/composables/useAuthFlow'
import { useAppearance } from '../src/composables/useAppearance'
import { useAccount } from '../src/composables/useAccount'
import type { AccountAdapter, AuthAdapter } from '../src/types'

function unconfiguredAdapter() {
  const reject = vi.fn(async (): Promise<never> => { throw new Error('ADAPTER_NOT_CONFIGURED') })
  const adapter: AuthAdapter = {
    challenge: reject, verifyCaptcha: reject, sendCode: reject, login: reject,
    register: reject, verifyResetCode: reject, resetPassword: reject, logout: reject,
  }
  return { adapter, reject }
}

describe('SSR without browser globals', () => {
  it('renders actual components without window/document or automatic adapter requests', async () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const { adapter, reject } = unconfiguredAdapter()
    const html = await renderToString(createSSRApp({ render: () => h(NovaTheme, {}, {
      default: () => [h(NovaButton, {}, { default: () => 'SSR ready' }), h(NovaAuthForm, { adapter })],
    }) }))
    expect(html).toContain('SSR ready')
    expect(html).toContain('欢迎回来')
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('type="email"')
    expect(html).not.toContain('demo@nova.example')
    expect(reject).not.toHaveBeenCalled()
  })

  it('isolates authentication and appearance state between SSR requests and instances', async () => {
    const captured: ReturnType<typeof useAuthFlow>[] = []
    const themes: ReturnType<typeof useAppearance>[] = []
    const surface = defineComponent({
      props: { label: { type: String, required: true } },
      setup(props) {
        const flow = useAuthFlow(unconfiguredAdapter().adapter)
        const theme = useAppearance()
        captured.push(flow); themes.push(theme)
        flow.fill({ email: `${props.label}@example.test` })
        if (props.label === 'first') theme.setAppearance({ mode: 'dark', accent: 'teal' })
        return () => h('p', `${flow.fields.email}:${theme.appearance.value.mode}:${theme.appearance.value.accent}`)
      },
    })
    const first = await renderToString(createSSRApp({ render: () => h(surface, { label: 'first' }) }))
    const second = await renderToString(createSSRApp({ render: () => h(surface, { label: 'second' }) }))
    expect(first).toContain('first@example.test:dark:teal')
    expect(second).toContain('second@example.test:light:iris')
    expect(captured[0]).not.toBe(captured[1])
    expect(captured[0]!.fields).not.toBe(captured[1]!.fields)
    expect(themes[0]!.appearance.value).not.toBe(themes[1]!.appearance.value)
  })

  it('gives multiple forms distinct field ids in a single SSR page', async () => {
    const html = await renderToString(createSSRApp({ render: () => h('main', [
      h(NovaAuthForm, { adapter: unconfiguredAdapter().adapter }),
      h(NovaAuthForm, { adapter: unconfiguredAdapter().adapter }),
    ]) }))
    const inputIds = [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map(match => match[1])
    expect(inputIds.length).toBe(4)
    expect(new Set(inputIds).size).toBe(inputIds.length)
  })

  it('renders the account surface safely and isolates account controllers on SSR', async () => {
    const reject = vi.fn(async (): Promise<never> => { throw new Error('ADAPTER_NOT_CONFIGURED') })
    const adapter: AccountAdapter = { load: reject, updateProfile: reject, updateNotifications: reject, changePassword: reject, requestEmailChangeCode: reject, changeEmail: reject, revokeDevice: reject, revokeOtherDevices: reject, markMessageRead: reject, markAllMessagesRead: reject, setTwoStep: reject }
    const controllers: ReturnType<typeof useAccount>[] = []
    const application = () => createSSRApp(defineComponent({ setup() {
      controllers.push(useAccount(adapter))
      return () => h(NovaTheme, {}, { default: () => h(NovaAccountCenter, { adapter }) })
    } }))
    const first = await renderToString(application())
    const second = await renderToString(application())
    expect(first).toContain('nova-account')
    expect(second).toContain('nova-account')
    expect(reject).not.toHaveBeenCalled()
    expect(controllers[0]!.snapshot).not.toBe(controllers[1]!.snapshot)
    controllers[0]!.error.value = 'Only the first request'
    expect(controllers[1]!.error.value).toBe('')
  })
})
