import { useNovaLocale } from '../locale'
import { computed, getCurrentScope, onScopeDispose, shallowRef, ref, watch } from 'vue'
import type {
  AccountAdapter,
  AccountSnapshot,
  MutationContext,
  RequestContext,
  NovaRequestResult,
} from '../types'

/** One isolated controller per account surface. Cancellation suppresses stale UI writes;
 * it cannot undo a mutation a remote server has already committed. Reload to reconcile. */
export function useAccount(adapter: AccountAdapter | (() => AccountAdapter)) {
  const { t } = useNovaLocale()
  const getAdapter = () => (typeof adapter === 'function' ? adapter() : adapter)
  const snapshot = shallowRef<AccountSnapshot | null>(null)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  let generation = 0
  let sequence = 0
  let controller: AbortController | undefined
  const instanceId = Math.random().toString(36).slice(2)

  function cancel() {
    generation += 1
    controller?.abort()
    controller = undefined
    busy.value = false
    error.value = ''
  }
  async function requestResult<T>(
    operation: (context: RequestContext) => Promise<T>,
  ): Promise<NovaRequestResult<T>> {
    if (busy.value) return { status: 'busy' }
    const epoch = ++generation
    controller = new AbortController()
    const context = { signal: controller.signal, requestId: `account-${instanceId}-${++sequence}` }
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      const result = await operation(context)
      if (epoch !== generation || context.signal.aborted) return { status: 'cancelled' }
      return { status: 'success', value: result }
    } catch (cause) {
      if (epoch === generation && !context.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : t('common.error')
        return { status: 'error', error: cause }
      }
      return { status: 'cancelled' }
    } finally {
      if (epoch === generation) busy.value = false
    }
  }
  /** Compatibility API: busy, cancelled and failed requests still return undefined. */
  async function request<T>(
    operation: (context: RequestContext) => Promise<T>,
  ): Promise<T | undefined> {
    const result = await requestResult(operation)
    return result.status === 'success' ? result.value : undefined
  }
  async function load() {
    const epoch = generation + 1
    const result = await request((context) => getAdapter().load(context))
    if (!result || epoch !== generation) return undefined
    snapshot.value = result
    return result
  }
  async function mutate(
    operation: (context: MutationContext) => Promise<AccountSnapshot>,
    message = t('common.saved'),
  ) {
    if (!snapshot.value) return undefined
    const revision = snapshot.value.revision
    const epoch = generation + 1
    const result = await request((context) => operation({ ...context, revision }))
    if (!result || epoch !== generation) return undefined
    if (result) {
      snapshot.value = result
      notice.value = message
    }
    return result
  }
  function clear() {
    cancel()
    snapshot.value = null
    notice.value = ''
  }
  // The exported composable must isolate adapters itself, not rely on a component watcher.
  watch(getAdapter, clear, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(clear)
  return {
    snapshot,
    busy,
    error,
    notice,
    unread: computed(() => snapshot.value?.messages.filter((message) => !message.read).length ?? 0),
    request,
    requestResult,
    load,
    mutate,
    cancel,
    clear,
  }
}
