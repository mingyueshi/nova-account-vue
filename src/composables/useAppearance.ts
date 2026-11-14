import { useNovaLocale } from '../locale'
import { lightPalettes } from '../palettes'
import { computed, getCurrentInstance, getCurrentScope, onScopeDispose, onMounted, ref } from 'vue'
import type { Accent, Appearance, ThemeMode } from '../types'
const modes: ThemeMode[] = ['light', 'dark', 'system']
const accents = Object.keys(lightPalettes) as Accent[]
export function parseAppearance(value: unknown): Appearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (Object.keys(candidate).sort().join(',') !== 'accent,mode') return null
  if (!modes.includes(candidate.mode as ThemeMode) || !accents.includes(candidate.accent as Accent))
    return null
  return { mode: candidate.mode as ThemeMode, accent: candidate.accent as Accent }
}
/** Per-scope; components initialize after mount, standalone browser scopes initialize immediately. */
export function useAppearance(
  options: {
    initial?: Appearance
    storageKey?: string | false
    onChange?: (value: Appearance) => void
  } = {},
) {
  if (!getCurrentScope())
    throw new Error('useAppearance requires component setup or an active effectScope.')
  const { t } = useNovaLocale()
  const appearance = ref<Appearance>(
    parseAppearance(options.initial) ?? { mode: 'light', accent: 'blue' },
  )
  const systemDark = ref(false)
  const storageError = ref('')
  const resolvedMode = computed(() =>
    appearance.value.mode === 'system'
      ? systemDark.value
        ? 'dark'
        : 'light'
      : appearance.value.mode,
  )
  let media: MediaQueryList | undefined
  let active = false
  const changed = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches
  }
  function start() {
    if (active || typeof window === 'undefined') return
    active = true
    if (typeof window.matchMedia === 'function') {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      systemDark.value = media.matches
      media.addEventListener('change', changed)
    }
    let restored: Appearance | undefined
    if (options.storageKey) {
      try {
        const stored = window.localStorage.getItem(options.storageKey)
        if (stored !== null)
          restored = parseAppearance(JSON.parse(stored)) ?? {
            mode: 'light',
            accent: 'blue',
          }
      } catch {
        storageError.value = t('appearance.storageError')
      }
    }
    if (
      restored &&
      (restored.mode !== appearance.value.mode || restored.accent !== appearance.value.accent)
    )
      setAppearance(restored, false)
  }
  onScopeDispose(() => {
    active = false
    media?.removeEventListener('change', changed)
  })
  if (getCurrentInstance()) onMounted(start)
  else start()
  function setAppearance(value: Appearance, persist = true) {
    const validated = parseAppearance(value)
    if (!validated) return
    appearance.value = validated
    options.onChange?.({ ...validated })
    if (active && persist && options.storageKey) {
      try {
        window.localStorage.setItem(options.storageKey, JSON.stringify(validated))
        storageError.value = ''
      } catch {
        storageError.value = t('appearance.storageError')
      }
    }
  }
  return {
    appearance,
    resolvedMode,
    storageError,
    setAppearance,
    reset: () => setAppearance({ mode: 'light', accent: 'blue' }),
  }
}
