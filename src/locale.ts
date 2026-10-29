import { computed, hasInjectionContext, inject, provide, toValue } from 'vue'
import type { InjectionKey, MaybeRefOrGetter } from 'vue'
import { enUS, zhCN } from './locales'
import type { NovaMessageKey, NovaMessages } from './locales'

export type NovaLocale = 'zh-CN' | 'en-US'
export interface NovaLocaleOptions {
  locale?: NovaLocale
  messages?: Partial<NovaMessages>
  /** UTC by default, so server rendering and hydration use the same time zone. */
  timeZone?: string
  dateTimeOptions?: Intl.DateTimeFormatOptions
  formatTime?: (value: string) => string
}

function createLocale(options: MaybeRefOrGetter<NovaLocaleOptions>) {
  const settings = computed(() => toValue(options))
  const locale = computed(() => settings.value.locale ?? 'zh-CN')
  function t(key: NovaMessageKey, values: Record<string, string | number> = {}) {
    const messages = locale.value === 'en-US' ? enUS : zhCN
    const message = settings.value.messages?.[key] ?? messages[key]
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      String(values[name] ?? placeholder),
    )
  }
  const formatter = computed(() => {
    try {
      const options = settings.value.dateTimeOptions ?? {}
      const defaults =
        options.dateStyle || options.timeStyle
          ? {}
          : ({
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            } as const)
      return new Intl.DateTimeFormat(locale.value, {
        ...defaults,
        ...options,
        timeZone: settings.value.timeZone ?? options.timeZone ?? 'UTC',
      })
    } catch {
      return new Intl.DateTimeFormat(locale.value, { timeZone: 'UTC' })
    }
  })
  function formatTime(value: string) {
    if (settings.value.formatTime) return settings.value.formatTime(value)
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? t('common.invalidTime') : formatter.value.format(date)
  }
  return { settings, locale, t, formatTime }
}

type LocaleContext = ReturnType<typeof createLocale>
const localeKey: InjectionKey<LocaleContext> = Symbol('nova-locale')

/** Safe outside component setup too; never creates shared mutable account or locale state. */
export function useNovaLocale() {
  return (hasInjectionContext() ? inject(localeKey, undefined) : undefined) ?? createLocale({})
}

/** Call in setup; use a getter for reactive props. NovaTheme already provides this context. */
export function provideNovaLocale(options: MaybeRefOrGetter<NovaLocaleOptions>) {
  const parent = useNovaLocale()
  const context = createLocale(() => {
    const own = toValue(options)
    const inherited = parent.settings.value
    return {
      locale: own.locale ?? inherited.locale,
      timeZone: own.timeZone ?? inherited.timeZone,
      dateTimeOptions: own.dateTimeOptions ?? inherited.dateTimeOptions,
      formatTime: own.formatTime ?? inherited.formatTime,
      messages: { ...inherited.messages, ...own.messages },
    }
  })
  provide(localeKey, context)
  return context
}
