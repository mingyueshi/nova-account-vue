import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import NovaTheme from '../src/components/NovaTheme.vue'
import NovaAuthForm from '../src/components/NovaAuthForm.vue'
import NovaAccountCenter from '../src/components/NovaAccountCenter.vue'
import NovaAppearance from '../src/components/NovaAppearance.vue'
import { useNovaLocale } from '../src/locale'
import { enUS, zhCN } from '../src/locales'
import { createDemoAuthAdapter } from '../demo/auth'
import { createDemoAccountAdapter } from '../demo/account'

const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
const clock = '2026-10-29T00:15:00Z'
const DateProbe = defineComponent({
  setup() {
    const { formatTime } = useNovaLocale()
    return () => h('p', [formatTime(clock), '|', formatTime('invalid')])
  },
})

describe('per-root locale and time display', () => {
  it('has a complete English dictionary and substitutes host text as plain text', () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(zhCN).sort())
    const wrapper = mount(NovaTheme, {
      props: { locale: 'en-US', messages: { 'auth.welcome': '<img src=x>' } },
      slots: { default: () => h(NovaAuthForm, { adapter: createDemoAuthAdapter() }) },
    })
    wrappers.push(wrapper)
    expect(wrapper.get('h1').text()).toBe('<img src=x>')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('input[type="email"]').attributes('placeholder')).toBe(
      'Enter your email address',
    )
    expect(wrapper.attributes('lang')).toBe('en-US')
  })

  it('reactively translates headings, navigation, choices and built-in validation', async () => {
    const wrapper = mount(NovaTheme, {
      props: { locale: 'zh-CN' },
      slots: {
        default: () => [
          h(NovaAuthForm, { adapter: createDemoAuthAdapter() }),
          h(NovaAccountCenter, {
            adapter: createDemoAccountAdapter({ wait: () => Promise.resolve() }),
          }),
          h(NovaAppearance, { modelValue: { mode: 'light', accent: 'iris' } }),
        ],
      },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.setProps({ locale: 'en-US' })
    expect(wrapper.findAll('h1').map((item) => item.text())).toEqual(['Welcome back', 'Overview'])
    expect(wrapper.get('[data-page="messages"]').text()).toContain('Messages')
    expect(wrapper.get('fieldset').text()).toContain('System')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Enter a valid email address.')
  })

  it('updates an existing validation error when the locale or host messages change', async () => {
    const adapter = createDemoAuthAdapter()
    const wrapper = mount(NovaTheme, {
      slots: { default: () => h(NovaAuthForm, { adapter }) },
    })
    wrappers.push(wrapper)
    await wrapper.get('input[type="email"]').setValue('invalid-address')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain(zhCN['flow.emailInvalid'])
    await wrapper.setProps({ locale: 'en-US' })
    expect(wrapper.text()).toContain(enUS['flow.emailInvalid'])
    expect(wrapper.text()).not.toContain(zhCN['flow.emailInvalid'])
    await wrapper.setProps({ messages: { 'flow.emailInvalid': 'Check your address.' } })
    expect(wrapper.text()).toContain('Check your address.')
    expect(wrapper.text()).not.toContain(enUS['flow.emailInvalid'])
    expect((wrapper.get('input[type="email"]').element as HTMLInputElement).value).toBe(
      'invalid-address',
    )
  })

  it('isolates two roots and inherits locale through a nested theme', () => {
    const wrapper = mount(
      defineComponent({
        render: () =>
          h('div', [
            h(
              NovaTheme,
              { locale: 'en-US', messages: { 'auth.welcome': 'Hello tenant A' } },
              {
                default: () =>
                  h(
                    NovaTheme,
                    {},
                    { default: () => h(NovaAuthForm, { adapter: createDemoAuthAdapter() }) },
                  ),
              },
            ),
            h(
              NovaTheme,
              {},
              { default: () => h(NovaAuthForm, { adapter: createDemoAuthAdapter() }) },
            ),
          ]),
      }),
    )
    wrappers.push(wrapper)
    expect(wrapper.findAll('h1').map((item) => item.text())).toEqual(['Hello tenant A', '欢迎回来'])
  })

  it('uses a deterministic UTC default and updates the configured time zone', async () => {
    const wrapper = mount(NovaTheme, {
      props: { locale: 'en-US', dateTimeOptions: { hourCycle: 'h23' } },
      slots: { default: () => h(DateProbe) },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain('00:15')
    expect(wrapper.text()).toContain('|—')
    await wrapper.setProps({ timeZone: 'Asia/Shanghai' })
    expect(wrapper.text()).toContain('08:15')
    await wrapper.setProps({
      dateTimeOptions: { dateStyle: 'long', timeStyle: 'short', hourCycle: 'h23' },
    })
    expect(wrapper.text()).toContain('October 29, 2026')
    expect(wrapper.text()).toContain('08:15')
    await wrapper.setProps({
      formatTime: (value) => (value === clock ? 'Host timestamp' : 'Unknown'),
    })
    expect(wrapper.text()).toBe('Host timestamp|Unknown')
  })

  it('gracefully handles an invalid time-zone configuration', () => {
    const wrapper = mount(NovaTheme, {
      props: { timeZone: 'invalid/time-zone' },
      slots: { default: () => h(DateProbe) },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).not.toContain('Invalid Date')
    expect(wrapper.text()).toContain('2026')
  })
})
