import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
/** Use the actual account content width, including embedded hosts and the sidebar. */
export function useWorkspace() {
  const root = ref<HTMLElement>()
  const width = ref(0)
  let observer: ResizeObserver | undefined
  let frame: number | undefined
  let pendingWidth = 0
  onMounted(() => {
    if (!root.value) return
    width.value = root.value.clientWidth
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const nextWidth = entry.contentRect.width
      if (nextWidth === width.value && frame === undefined) return
      pendingWidth = nextWidth
      if (frame !== undefined) return
      // Breakpoint changes can replace detail panes and resize this same root.
      // Commit outside ResizeObserver delivery to avoid a same-frame feedback loop.
      frame = requestAnimationFrame(() => {
        frame = undefined
        width.value = pendingWidth
      })
    })
    observer.observe(root.value)
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
  })
  return { root, width, wide: computed(() => width.value >= 1040) }
}
