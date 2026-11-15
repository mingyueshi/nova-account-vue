import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

/** Keep the full-screen auth shell inside the area above the software keyboard. */
export function useAuthViewport(onChange: () => void) {
  const style = shallowRef<Record<string, string>>({})
  let viewport: VisualViewport | null = null
  function sync() {
    // Pinch zoom must keep its native pan/zoom behavior.
    if (!viewport || viewport.scale !== 1) return
    style.value = {
      '--demo-auth-height': `${viewport.height}px`,
      '--demo-auth-top': `${viewport.offsetTop}px`,
      '--demo-auth-actions-position': viewport.height < 500 ? 'sticky' : 'static',
    }
    onChange()
  }
  onMounted(() => {
    viewport = window.visualViewport
    viewport?.addEventListener('resize', sync, { passive: true })
    viewport?.addEventListener('scroll', sync, { passive: true })
    sync()
  })
  onBeforeUnmount(() => {
    viewport?.removeEventListener('resize', sync)
    viewport?.removeEventListener('scroll', sync)
  })
  return style
}
