import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
/** Use the actual account content width, including embedded hosts and the sidebar. */
export function useWorkspace() {
  const root = ref<HTMLElement>()
  const width = ref(0)
  let observer: ResizeObserver | undefined
  onMounted(() => {
    if (!root.value) return
    width.value = root.value.clientWidth
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(([entry]) => {
      if (entry) width.value = entry.contentRect.width
    })
    observer.observe(root.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return { root, width, wide: computed(() => width.value >= 1040) }
}
