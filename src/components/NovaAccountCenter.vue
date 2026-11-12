<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, useId, watch } from 'vue'
import type {
  AccountAdapter,
  AccountPage,
  AccountExtraPage,
  AccountSnapshot,
  NotificationPreferences,
  Profile,
} from '../types'
import { useAccount } from '../composables/useAccount'
import NovaButton from './NovaButton.vue'
import NovaField from './NovaField.vue'
import NovaDialog from './NovaDialog.vue'
import NovaIcon from './NovaIcon.vue'

const { t, formatTime } = useNovaLocale()
const mobileNavId = useId()
const props = withDefaults(
  defineProps<{
    adapter: AccountAdapter
    simulated?: boolean
    page?: AccountPage
    initialPage?: AccountPage
    /** Visible account pages; defaults to all seven. */
    pages?: AccountPage[]
    extraPages?: AccountExtraPage[]
    /** Hide the two-step row when the host has no step-up implementation. */
    twoStep?: boolean
  }>(),
  { twoStep: true },
)
const emit = defineEmits<{
  logout: []
  pageChange: [page: AccountPage]
  'update:page': [page: AccountPage]
}>()
type SecurityValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  email: string
  code: string
}
defineSlots<{
  overview?(props: {
    snapshot: AccountSnapshot
    adapter: AccountAdapter
    refresh: () => Promise<AccountSnapshot | undefined>
  }): unknown
  appearance(): unknown
  page(props: {
    page: AccountPage
    snapshot: AccountSnapshot
    adapter: AccountAdapter
    refresh: () => Promise<AccountSnapshot | undefined>
  }): unknown
  /** Replaces the built-in profile page; the host owns drafts and unsaved guards for it. */
  profile(props: {
    snapshot: AccountSnapshot
    adapter: AccountAdapter
    refresh: () => Promise<AccountSnapshot | undefined>
  }): unknown
  security(props: {
    snapshot: AccountSnapshot
    adapter: AccountAdapter
    refresh: () => Promise<AccountSnapshot | undefined>
  }): unknown
  securityFormTools(props: { fill: (values: Partial<SecurityValues>) => void }): unknown
}>()
const { snapshot, busy, error, notice, unread, request, load, mutate, cancel, clear } = useAccount(
  () => props.adapter,
)
const internalPage = ref<AccountPage | undefined>(props.initialPage ?? 'overview')
const heading = ref<HTMLElement>()
const content = ref<HTMLElement>()
const readerWide = ref(false)
let contentObserver: ResizeObserver | undefined
const queued = ref<AccountPage | 'logout' | null>(null)
const profile = reactive<Omit<Profile, 'id'>>({ nickname: '', bio: '', avatar: 'iris' })
const notifications = reactive<NotificationPreferences>({
  product: false,
  email: false,
  security: true,
})
const tabs = computed<
  { id: AccountPage; label: string; symbol: string; description: string; group?: string }[]
>(() => [
  {
    id: 'overview',
    label: t('page.overview'),
    symbol: '◈',
    description: t('page.overviewDescription'),
  },
  {
    id: 'profile',
    label: t('page.profile'),
    symbol: '◇',
    description: t('page.profileDescription'),
  },
  {
    id: 'security',
    label: t('page.security'),
    symbol: '♧',
    description: t('page.securityDescription'),
  },
  {
    id: 'devices',
    label: t('page.devices'),
    symbol: '▣',
    description: t('page.devicesDescription'),
  },
  {
    id: 'notifications',
    label: t('page.notifications'),
    symbol: '♧',
    description: t('page.notificationsDescription'),
  },
  {
    id: 'messages',
    label: t('page.messages'),
    symbol: '✉',
    description: t('page.messagesDescription'),
  },
  {
    id: 'appearance',
    label: t('appearance.title'),
    symbol: '◐',
    description: t('page.appearanceDescription'),
  },
  ...(props.extraPages ?? [])
    .filter(
      (item, index, items) =>
        item.id.startsWith('custom:') &&
        items.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .map((item) => ({ ...item, symbol: item.symbol ?? '◇' })),
])
const visibleTabs = computed(() =>
  props.pages ? tabs.value.filter((tab) => props.pages!.includes(tab.id)) : tabs.value,
)
function isPageAvailable(target: AccountPage | undefined) {
  return visibleTabs.value.some((tab) => tab.id === target)
}
const page = computed(() => {
  const requested = props.page ?? internalPage.value
  return isPageAvailable(requested) ? requested : visibleTabs.value[0]?.id
})
const currentTab = computed(() => visibleTabs.value.find((tab) => tab.id === page.value))
// Normalize only internal state. Controlled pages never echo updates to their host.
watch(
  visibleTabs,
  () => {
    if (props.page === undefined && !isPageAvailable(internalPage.value))
      internalPage.value = visibleTabs.value[0]?.id
  },
  { immediate: true, flush: 'sync' },
)
const showTwoStep = computed(() => props.twoStep !== false)
const avatarOptions = computed<{ id: Profile['avatar']; label: string; color: string }[]>(() => [
  { id: 'iris', label: t('appearance.iris'), color: '#6958c5' },
  { id: 'teal', label: t('appearance.teal'), color: '#217560' },
  { id: 'sun', label: t('appearance.sun'), color: '#956100' },
  { id: 'graphite', label: t('appearance.graphite'), color: '#636172' },
])
const preferenceOptions = computed<
  { key: keyof NotificationPreferences; label: string; description: string }[]
>(() => [
  {
    key: 'product',
    label: t('notifications.product'),
    description: t('notifications.productDescription'),
  },
  {
    key: 'email',
    label: t('notifications.email'),
    description: t('notifications.emailDescription'),
  },
  {
    key: 'security',
    label: t('notifications.security'),
    description: t('notifications.securityDescription'),
  },
])
const panel =
  'na:rounded-2xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:p-5 na:sm:p-7'
const muted = 'na:text-sm na:leading-6 na:text-[var(--na-muted)]'
const dirty = computed(() => {
  if (!snapshot.value) return false
  if (page.value === 'profile')
    return (
      profile.nickname !== snapshot.value.profile.nickname ||
      profile.bio !== snapshot.value.profile.bio ||
      profile.avatar !== snapshot.value.profile.avatar
    )
  if (page.value === 'notifications')
    return preferenceOptions.value.some(
      (option) => notifications[option.key] !== snapshot.value!.notifications[option.key],
    )
  return false
})
function syncDrafts() {
  if (!snapshot.value) return
  const { nickname, bio, avatar } = snapshot.value.profile
  Object.assign(profile, { nickname, bio, avatar })
  Object.assign(notifications, snapshot.value.notifications)
}
async function refresh() {
  const result = await load()
  if (result) syncDrafts()
  return result
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => {
  void refresh()
  window.addEventListener('beforeunload', beforeUnload)
  if (content.value && typeof ResizeObserver !== 'undefined') {
    contentObserver = new ResizeObserver(([entry]) => {
      if (entry) readerWide.value = entry.contentRect.width >= 1040
    })
    contentObserver.observe(content.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  contentObserver?.disconnect()
})

function onMobileNavigation(event: Event) {
  const select = event.target as HTMLSelectElement
  const target = select.value as AccountPage
  select.value = page.value ?? ''
  requestNavigation(target)
}
const navigationGroups = computed(() => {
  const groups: { label: string; tabs: typeof visibleTabs.value }[] = []
  for (const tab of visibleTabs.value) {
    const label = tab.group || t('account.settings')
    const group = groups.find((item) => item.label === label)
    if (group) group.tabs.push(tab)
    else groups.push({ label, tabs: [tab] })
  }
  return groups
})
function requestNavigation(target: AccountPage | 'logout') {
  if (target !== 'logout' && !isPageAvailable(target)) return
  if (target === page.value) return
  if (dirty.value) {
    queued.value = target
    return
  }
  navigate(target)
}
function navigate(target: AccountPage | 'logout') {
  if (target !== 'logout' && !isPageAvailable(target)) return
  if (target === 'logout') {
    cancel()
    closeModal()
    queued.value = null
    notice.value = ''
    emit('logout')
    return
  }
  if (props.page === undefined) internalPage.value = target
  emit('update:page', target)
}
function discardAndNavigate() {
  if (queued.value) {
    const target = queued.value
    queued.value = null
    syncDrafts()
    navigate(target)
  }
}
function discardDraft() {
  cancel()
  syncDrafts()
}
async function saveProfile() {
  if (!dirty.value) return
  const result = await mutate(
    (context) => props.adapter.updateProfile({ ...profile }, context),
    props.simulated ? t('profile.demoSaved') : t('profile.saved'),
  )
  if (result) syncDrafts()
}
/** Optional adapter capability: an avatar uploader appears in the profile page when present. */
const canUploadAvatar = computed(() => typeof props.adapter.uploadAvatar === 'function')
const avatarBusy = ref(false)
let avatarOperation: symbol | undefined
function readAvatar(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const cleanup = () => {
      signal.removeEventListener('abort', abort)
      reader.onload = null
      reader.onerror = null
      reader.onabort = null
    }
    const abort = () => {
      cleanup()
      if (reader.readyState === FileReader.LOADING) reader.abort()
      reject(new DOMException('Avatar read cancelled', 'AbortError'))
    }
    reader.onload = () => {
      cleanup()
      resolve(String(reader.result))
    }
    reader.onerror = () => {
      cleanup()
      reject(new Error(t('profile.avatarReadError')))
    }
    reader.onabort = abort
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) return abort()
    try {
      reader.readAsDataURL(file)
    } catch (cause) {
      cleanup()
      reject(cause)
    }
  })
}
async function uploadAvatar(file: File | null) {
  const adapter = props.adapter
  if (!adapter.uploadAvatar || !snapshot.value || busy.value) return
  const operation = Symbol('avatar')
  avatarOperation = operation
  avatarBusy.value = true
  const finish = () => {
    if (avatarOperation === operation) {
      avatarOperation = undefined
      avatarBusy.value = false
    }
  }
  try {
    await mutate(
      async (context) => {
        context.signal.addEventListener('abort', finish, { once: true })
        try {
          const dataUrl = file ? await readAvatar(file, context.signal) : null
          if (context.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
          return await adapter.uploadAvatar!({ dataUrl }, context)
        } finally {
          context.signal.removeEventListener('abort', finish)
        }
      },
      props.simulated ? t('profile.avatarDemoSaved') : t('profile.avatarSaved'),
    )
  } finally {
    finish()
  }
}
function onAvatarFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void uploadAvatar(file)
}
async function removeAvatar() {
  await uploadAvatar(null)
}
async function saveNotifications() {
  if (!dirty.value) return
  const result = await mutate(
    (context) => props.adapter.updateNotifications({ ...notifications }, context),
    props.simulated ? t('notifications.demoSaved') : t('notifications.saved'),
  )
  if (result) syncDrafts()
}
const messageFilter = ref<'all' | 'unread'>('all')
const visibleMessages = computed(
  () =>
    snapshot.value?.messages.filter((message) => messageFilter.value === 'all' || !message.read) ??
    [],
)
const selectedMessageId = ref('')
const selectedMessage = computed(() =>
  snapshot.value?.messages.find((message) => message.id === selectedMessageId.value),
)
async function markRead(messageId: string) {
  await mutate((context) => props.adapter.markMessageRead(messageId, context), t('messages.marked'))
}
function openMessage(messageId: string) {
  modalEpoch++
  selectedMessageId.value = messageId
  if (!readerWide.value) modal.value = 'message'
  if (!selectedMessage.value?.read) void markRead(messageId)
}
const activityFilter = ref<'all' | 'credentials' | 'devices'>('all')
const activityPage = ref(0)
const securityActivities = computed(
  () =>
    snapshot.value?.activity.filter(
      (item) =>
        item.category !== 'account' &&
        (activityFilter.value === 'all' || item.category === activityFilter.value),
    ) ?? [],
)
const activityPages = computed(() => Math.max(1, Math.ceil(securityActivities.value.length / 4)))
const visibleActivities = computed(() =>
  securityActivities.value.slice(activityPage.value * 4, activityPage.value * 4 + 4),
)
watch(activityFilter, () => {
  activityPage.value = 0
})
watch(activityPages, (pages) => {
  activityPage.value = Math.min(activityPage.value, pages - 1)
})
const filterOptions = computed<{ value: 'all' | 'credentials' | 'devices'; label: string }[]>(
  () => [
    { value: 'all', label: t('security.all') },
    { value: 'credentials', label: t('security.credentials') },
    { value: 'devices', label: t('security.devices') },
  ],
)

type Modal = 'password' | 'email' | 'twoStep' | 'revoke' | 'revokeAll' | 'message' | null
const modal = ref<Modal>(null)
watch(readerWide, (wide) => {
  if (wide && modal.value === 'message') modal.value = null
})
let modalEpoch = 0
const deviceId = ref('')
const securityValues = reactive<SecurityValues>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  email: '',
  code: '',
})
const codeSent = ref(false)
const demoCode = ref('')
const modalTitle = computed(
  () =>
    ({
      password: t('security.changePassword'),
      email: t('security.changeEmail'),
      twoStep: t('security.twoStepDemo'),
      revoke: t('devices.confirmOne'),
      revokeAll: t('devices.confirmAll'),
      message: selectedMessage.value?.title ?? t('messages.detail'),
    })[modal.value ?? 'message'],
)
function clearSecurity() {
  Object.assign(securityValues, {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    email: '',
    code: '',
  })
  codeSent.value = false
  demoCode.value = ''
}
function closeModal() {
  modalEpoch++
  cancel()
  modal.value = null
  selectedMessageId.value = ''
  clearSecurity()
}
watch(
  showTwoStep,
  (available) => {
    if (!available && modal.value === 'twoStep') closeModal()
  },
  { flush: 'sync' },
)
function openModal(kind: Modal, targetDevice = '') {
  modalEpoch++
  cancel()
  clearSecurity()
  modal.value = kind
  deviceId.value = targetDevice
}
function fillSecurity(values: Partial<SecurityValues>) {
  Object.assign(securityValues, values)
}
watch(
  () => [securityValues.email, securityValues.currentPassword],
  () => {
    if (modal.value === 'email') {
      modalEpoch++
      cancel()
      codeSent.value = false
      demoCode.value = ''
      securityValues.code = ''
    }
  },
  { flush: 'sync' },
)
async function sendEmailCode() {
  const epoch = modalEpoch
  const input = { email: securityValues.email, currentPassword: securityValues.currentPassword }
  const result = await request((context) => props.adapter.requestEmailChangeCode(input, context))
  if (
    result &&
    modal.value === 'email' &&
    epoch === modalEpoch &&
    input.email === securityValues.email &&
    input.currentPassword === securityValues.currentPassword
  ) {
    codeSent.value = true
    demoCode.value = props.simulated ? (result.demoCode ?? '') : ''
  }
}
async function submitSecurity() {
  const epoch = modalEpoch
  const input = { ...securityValues }
  const action = modal.value
  let result: AccountSnapshot | undefined
  if (action === 'password')
    result = await mutate(
      (context) => props.adapter.changePassword(input, context),
      t('security.passwordDone'),
    )
  else if (action === 'email' && codeSent.value)
    result = await mutate(
      (context) => props.adapter.changeEmail({ email: input.email, code: input.code }, context),
      t('security.emailDone'),
    )
  else if (action === 'twoStep' && showTwoStep.value && snapshot.value) {
    const enabled = !snapshot.value.security.twoStepEnabled
    result = await mutate(
      (context) =>
        props.adapter.setTwoStep(
          { enabled, currentPassword: input.currentPassword, code: input.code },
          context,
        ),
      t('security.twoStepDone'),
    )
  } else if (action === 'revoke')
    result = await mutate(
      (context) => props.adapter.revokeDevice(deviceId.value, context),
      props.simulated ? t('devices.demoRevoked') : t('devices.revoked'),
    )
  else if (action === 'revokeAll')
    result = await mutate(
      (context) => props.adapter.revokeOtherDevices(context),
      props.simulated ? t('devices.demoAllRevoked') : t('devices.allRevoked'),
    )
  if (result && epoch === modalEpoch) closeModal()
}
watch(page, (target) => {
  // All pages share the first snapshot. Do not abort its load during navigation.
  if (snapshot.value) cancel()
  if (modal.value !== null) closeModal()
  queued.value = null
  notice.value = ''
  syncDrafts()
  if (target) emit('pageChange', target)
  void nextTick(() => {
    if (content.value) content.value.scrollTop = 0
    heading.value?.focus({ preventScroll: true })
  })
})
watch(
  () => props.adapter,
  () => {
    closeModal()
    clear()
    queued.value = null
    const initial = props.initialPage ?? 'overview'
    internalPage.value = isPageAvailable(initial) ? initial : visibleTabs.value[0]?.id
    void refresh()
  },
)
defineExpose({ refresh, fillSecurity })
</script>

<template>
  <div
    class="na:flex na:min-h-0 na:w-full na:flex-1 na:flex-col na:md:flex-row"
    data-nova-account-center
  >
    <aside
      data-account-sidebar
      class="na:flex na:shrink-0 na:flex-col na:border-b na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:md:w-60 na:md:overflow-y-auto na:md:border-r na:md:border-b-0"
    >
      <div v-if="snapshot" class="na:hidden na:items-center na:gap-3 na:px-6 na:py-8 na:md:flex">
        <span
          class="na:flex na:size-11 na:shrink-0 na:items-center na:justify-center na:rounded-2xl na:bg-[var(--na-soft)] na:text-lg na:font-medium na:text-[var(--na-brand)]"
          aria-hidden="true"
          >{{ snapshot.profile.nickname.slice(0, 1).toUpperCase() }}</span
        >
        <div class="na:min-w-0">
          <strong class="na:block na:truncate na:text-sm na:font-semibold">{{
            snapshot.profile.nickname
          }}</strong
          ><span class="na:mt-1 na:block na:text-xs na:text-[var(--na-muted)]"
            >{{ t('messages.account') }}{{ simulated ? t('security.demoSuffix') : '' }}</span
          >
        </div>
      </div>
      <div class="na:flex na:items-center na:gap-3 na:p-3 na:md:hidden" data-mobile-account-nav>
        <label :for="mobileNavId" class="na:sr-only">{{ t('account.navigation') }}</label>
        <select
          :id="mobileNavId"
          :value="page"
          class="na:min-h-11 na:min-w-0 na:flex-1 na:rounded-xl na:border na:border-[var(--na-control)] na:bg-[var(--na-surface)] na:px-3 na:text-sm na:text-[var(--na-ink)]"
          @change="onMobileNavigation"
        >
          <optgroup v-for="group in navigationGroups" :key="group.label" :label="group.label">
            <option v-for="tab in group.tabs" :key="tab.id" :value="tab.id">{{ tab.label }}</option>
          </optgroup>
        </select>
        <NovaButton
          variant="ghost"
          :aria-label="t('account.logout')"
          @click="requestNavigation('logout')"
          ><NovaIcon name="logout"
        /></NovaButton>
      </div>
      <nav
        data-account-nav
        :aria-label="t('account.navigation')"
        class="na:hidden na:gap-1 na:p-3 na:md:flex na:md:flex-col na:md:px-4 na:md:py-0"
      >
        <template v-for="(tab, index) in visibleTabs" :key="tab.id">
          <p
            v-if="tab.group && tab.group !== visibleTabs[index - 1]?.group"
            class="na:hidden na:mt-5 na:mb-1 na:px-4 na:text-xs na:text-[var(--na-muted)] na:md:block"
          >
            {{ tab.group }}
          </p>
          <button
            type="button"
            :aria-current="page === tab.id ? 'page' : undefined"
            :data-page="tab.id"
            class="na:flex na:shrink-0 na:items-center na:gap-3 na:rounded-xl na:border-0 na:px-4 na:py-3 na:text-left na:text-sm na:transition-colors na:hover:bg-[var(--na-soft)]"
            :class="
              page === tab.id
                ? 'na:bg-[var(--na-soft)] na:font-medium na:text-[var(--na-brand)]'
                : 'na:bg-transparent na:text-[var(--na-muted)]'
            "
            @click="requestNavigation(tab.id)"
          >
            <NovaIcon :name="tab.id" :fallback="tab.symbol" class="na:shrink-0" />
            <span>{{ tab.label }}</span
            ><span
              v-if="tab.id === 'messages' && unread"
              class="na:rounded-full na:bg-[var(--na-soft)] na:px-1.5 na:text-xs na:text-[var(--na-brand)]"
              :aria-label="t('account.unreadCount', { count: unread })"
              >{{ unread }}</span
            >
          </button>
        </template>
        <button
          type="button"
          class="na:shrink-0 na:rounded-xl na:border-0 na:bg-transparent na:px-4 na:py-3 na:text-left na:text-sm na:text-[var(--na-muted)] na:hover:bg-[var(--na-soft)] na:md:mt-6 na:md:border-t na:md:border-[var(--na-line)]"
          @click="requestNavigation('logout')"
        >
          <NovaIcon name="logout" :size="18" />{{ t('account.logout') }}
        </button>
      </nav>
      <p
        v-if="simulated"
        class="na:mt-auto na:hidden na:px-7 na:py-6 na:text-xs na:leading-5 na:text-[var(--na-muted)] na:md:block"
      >
        {{ t('account.memory') }}
      </p>
    </aside>
    <main
      ref="content"
      data-account-content
      :data-account-page="page"
      class="na:min-h-0 na:min-w-0 na:flex-1 na:overflow-y-auto na:bg-[var(--na-canvas)] na:p-5 na:sm:p-8 na:lg:p-12"
      :aria-busy="busy"
    >
      <div class="na:min-w-0 na:w-full">
        <header
          v-if="currentTab"
          data-account-page-header
          class="na:mb-7 na:flex na:flex-wrap na:items-start na:justify-between na:gap-4"
        >
          <div>
            <h1
              ref="heading"
              tabindex="-1"
              class="na:m-0 na:text-2xl na:font-semibold na:tracking-tight"
            >
              {{ currentTab.label }}
            </h1>
            <p :class="muted" class="na:mt-2 na:mb-0">{{ currentTab.description }}</p>
          </div>
          <span
            v-if="simulated"
            class="na:rounded-full na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-3 na:py-1.5 na:text-xs na:text-[var(--na-muted)]"
            >{{ t('account.demo') }}</span
          >
        </header>
        <div
          v-if="error && !modal"
          role="alert"
          class="na:mb-5 na:rounded-xl na:border na:border-[var(--na-error)] na:p-4 na:text-sm na:text-[var(--na-error)]"
        >
          {{ error }}
          <NovaButton v-if="!snapshot" variant="ghost" @click="refresh">{{
            t('common.reload')
          }}</NovaButton>
        </div>
        <p v-if="notice" role="status" class="na:mb-5 na:text-sm na:text-[var(--na-brand)]">
          {{ notice }}
        </p>
        <p v-if="!snapshot && busy" role="status" :class="muted">{{ t('account.loading') }}</p>
        <template v-if="snapshot">
          <section v-if="page === 'overview'" class="nova-overview na:space-y-6">
            <div class="nova-overview-main na:space-y-6">
              <div
                :class="panel"
                class="nova-overview-profile na:flex na:flex-wrap na:items-center na:gap-5"
              >
                <img
                  v-if="snapshot.profile.avatarUrl"
                  :src="snapshot.profile.avatarUrl"
                  :alt="t('profile.avatarAlt')"
                  class="na:size-16 na:rounded-2xl na:border na:border-[var(--na-line)] na:object-cover"
                />
                <div
                  v-else
                  class="na:flex na:size-16 na:items-center na:justify-center na:rounded-2xl na:bg-[var(--na-soft)] na:text-2xl na:text-[var(--na-brand)]"
                  aria-hidden="true"
                >
                  {{ snapshot.profile.nickname.slice(0, 1).toUpperCase() }}
                </div>
                <div class="na:min-w-0 na:flex-1">
                  <h2 class="na:m-0 na:text-xl na:font-semibold">
                    {{ t('account.greeting', { name: snapshot.profile.nickname }) }}
                  </h2>
                  <p class="na:my-2 na:break-all" :class="muted">{{ snapshot.email }}</p>
                  <p class="na:m-0 na:break-words" :class="muted">
                    {{ snapshot.profile.bio || t('account.emptyBio') }}
                  </p>
                </div>
                <NovaButton
                  v-if="isPageAvailable('profile')"
                  variant="secondary"
                  @click="requestNavigation('profile')"
                  >{{ t('account.editProfile') }}</NovaButton
                >
              </div>
              <div
                class="nova-overview-shortcuts na:grid na:grid-cols-1 na:gap-4 na:sm:grid-cols-2 na:xl:grid-cols-4"
              >
                <button
                  v-for="tab in visibleTabs.filter((item) =>
                    ['profile', 'security', 'devices', 'notifications'].includes(item.id),
                  )"
                  :key="tab.id"
                  type="button"
                  :class="panel"
                  class="na:flex na:items-center na:gap-4 na:text-left na:hover:border-[var(--na-brand)]"
                  @click="requestNavigation(tab.id)"
                >
                  <NovaIcon :name="tab.id" class="na:shrink-0 na:text-[var(--na-brand)]" />
                  <div>
                    <strong class="na:block na:text-sm na:font-medium">{{ tab.label }}</strong
                    ><span class="na:mt-1 na:block na:text-xs na:text-[var(--na-muted)]">{{
                      tab.id === 'devices'
                        ? t('account.deviceCount', {
                            count: snapshot.devices.length,
                            simulated: simulated ? t('account.simulated') : '',
                          })
                        : t('account.manage')
                    }}</span>
                  </div>
                  <NovaIcon
                    name="chevron"
                    :size="16"
                    class="na:ml-auto na:text-[var(--na-muted)]"
                  />
                </button>
              </div>
            </div>
            <section :class="panel" class="nova-overview-activity">
              <h2 class="na:mt-0 na:mb-5 na:text-base na:font-semibold">
                {{ t('account.recent') }}
              </h2>
              <ul class="na:m-0 na:list-none na:p-0">
                <li
                  v-for="entry in snapshot.activity.slice(0, 4)"
                  :key="entry.id"
                  class="na:flex na:flex-wrap na:gap-3 na:border-t na:border-[var(--na-line)] na:py-4"
                >
                  <span
                    class="na:mt-2 na:size-1.5 na:rounded-full na:bg-[var(--na-brand)]"
                    aria-hidden="true"
                  ></span>
                  <div class="na:min-w-0 na:flex-1">
                    <strong class="na:text-sm na:font-medium">{{ entry.title }}</strong>
                    <p class="na:mt-1 na:mb-0" :class="muted">{{ entry.description }}</p>
                  </div>
                  <time :datetime="entry.at" class="na:text-xs na:text-[var(--na-muted)]">{{
                    formatTime(entry.at)
                  }}</time>
                </li>
              </ul>
            </section>
            <div v-if="$slots.overview" class="nova-overview-extension">
              <slot name="overview" :snapshot="snapshot" :adapter="adapter" :refresh="refresh" />
            </div>
          </section>

          <div v-else-if="page === 'profile'" class="na:min-w-0">
            <slot name="profile" :snapshot="snapshot" :adapter="adapter" :refresh="refresh">
              <form class="nova-profile-form na:space-y-5" @submit.prevent="saveProfile">
                <section :class="panel" class="nova-profile-grid na:grid na:gap-6">
                  <div class="nova-profile-avatar">
                    <div class="nova-profile-preview na:grid na:gap-3">
                      <img
                        v-if="snapshot.profile.avatarUrl"
                        :src="snapshot.profile.avatarUrl"
                        :alt="t('profile.avatarAlt')"
                        width="80"
                        height="80"
                        class="na:size-20 na:rounded-2xl na:object-cover"
                      /><span
                        v-else
                        :style="{
                          backgroundColor: avatarOptions.find((item) => item.id === profile.avatar)
                            ?.color,
                        }"
                        >{{
                          (profile.nickname || snapshot.profile.nickname).slice(0, 1).toUpperCase()
                        }}</span
                      ><strong>{{ profile.nickname || snapshot.profile.nickname }}</strong>
                      <p>{{ snapshot.email }}</p>
                    </div>
                    <fieldset class="na:m-0 na:border-0 na:p-0" :disabled="busy || avatarBusy">
                      <legend class="na:mb-3 na:text-sm na:font-medium">
                        {{ t('profile.avatars') }}
                      </legend>
                      <div class="na:flex na:flex-wrap na:items-center na:gap-4">
                        <img
                          v-if="snapshot.profile.avatarUrl"
                          :src="snapshot.profile.avatarUrl"
                          :alt="t('profile.avatarAlt')"
                          class="na:size-12 na:rounded-2xl na:border na:border-[var(--na-line)] na:object-cover"
                        />
                        <div class="na:flex na:flex-wrap na:gap-3">
                          <button
                            v-for="avatar in avatarOptions"
                            :key="avatar.id"
                            type="button"
                            :aria-label="avatar.label"
                            :aria-pressed="profile.avatar === avatar.id"
                            class="na:flex na:size-12 na:items-center na:justify-center na:rounded-2xl na:border-2 na:text-lg na:text-white"
                            :class="
                              profile.avatar === avatar.id
                                ? 'na:border-[var(--na-ink)] na:ring-2 na:ring-[var(--na-surface)]'
                                : 'na:border-transparent'
                            "
                            :style="{ backgroundColor: avatar.color }"
                            @click="profile.avatar = avatar.id"
                          >
                            {{ profile.avatar === avatar.id ? '✓' : 'N' }}
                          </button>
                        </div>
                      </div>
                      <div
                        v-if="canUploadAvatar"
                        class="na:mt-4 na:flex na:flex-wrap na:items-center na:gap-3"
                      >
                        <label
                          class="nova-avatar-upload na:inline-flex na:cursor-pointer na:items-center na:gap-2 na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-4 na:py-2.5 na:text-sm na:font-medium na:hover:bg-[var(--na-soft)]"
                        >
                          <NovaIcon name="upload" :size="16" />{{
                            avatarBusy ? t('profile.avatarUploading') : t('profile.avatarUpload')
                          }}
                          <input
                            type="file"
                            accept="image/*"
                            class="na:sr-only"
                            @change="onAvatarFile"
                          />
                        </label>
                        <NovaButton
                          v-if="snapshot.profile.avatarUrl"
                          variant="ghost"
                          :disabled="avatarBusy"
                          @click="removeAvatar"
                          >{{ t('profile.avatarRemove') }}</NovaButton
                        >
                      </div>
                    </fieldset>
                  </div>
                  <div class="nova-profile-fields na:grid na:gap-6">
                    <h2>{{ t('profile.details') }}</h2>
                    <div class="nova-profile-identity na:grid na:gap-6">
                      <NovaField
                        v-model="profile.nickname"
                        :label="t('profile.nickname')"
                        :maxlength="24"
                        autocomplete="nickname"
                        :hint="t('profile.count', { count: profile.nickname.length, max: 24 })"
                        :disabled="busy"
                      />
                      <NovaField
                        :model-value="snapshot.email"
                        :label="t('security.email')"
                        readonly
                      />
                    </div>
                    <NovaField
                      v-model="profile.bio"
                      as="textarea"
                      :label="t('profile.bio')"
                      :maxlength="120"
                      :rows="4"
                      :disabled="busy"
                      :hint="t('profile.count', { count: profile.bio.length, max: 120 })"
                    />
                    <p v-if="simulated" :class="muted" class="na:m-0">{{ t('profile.demo') }}</p>
                  </div>
                </section>
                <div
                  data-account-savebar
                  class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4"
                >
                  <p role="status" class="na:m-0 na:text-xs na:text-[var(--na-muted)]">
                    {{ dirty ? t('profile.dirty') : t('profile.clean') }}
                  </p>
                  <div class="na:flex na:gap-3">
                    <NovaButton variant="secondary" @click="discardDraft">{{
                      t('common.cancel')
                    }}</NovaButton
                    ><NovaButton variant="primary" type="submit" :disabled="!dirty || busy"
                      ><NovaIcon v-if="!busy" name="save" :size="16" />{{
                        busy ? t('common.saving') : t('profile.save')
                      }}</NovaButton
                    >
                  </div>
                </div>
              </form>
            </slot>
          </div>

          <section v-else-if="page === 'security'" class="nova-security-grid na:space-y-6">
            <div class="nova-security-settings na:grid na:gap-5">
              <slot name="security" :snapshot="snapshot" :adapter="adapter" :refresh="refresh">
                <div :class="panel" class="na:space-y-6">
                  <div class="na:flex na:items-center na:justify-between na:gap-4">
                    <div>
                      <h2 class="na:m-0 na:text-sm na:font-semibold">
                        {{ t('security.password') }}
                      </h2>
                      <p class="na:mt-2 na:mb-0" :class="muted">
                        {{
                          snapshot.security.passwordUpdatedAt
                            ? t('security.updated', {
                                time: formatTime(snapshot.security.passwordUpdatedAt),
                              })
                            : t('security.configured')
                        }}{{ simulated ? t('security.demoPassword') : '' }}
                      </p>
                    </div>
                    <NovaButton
                      v-if="simulated"
                      variant="secondary"
                      :disabled="busy"
                      @click="openModal('password')"
                      >{{ t('common.edit') }}</NovaButton
                    >
                  </div>
                  <div
                    class="na:flex na:items-center na:justify-between na:gap-4 na:border-t na:border-[var(--na-line)] na:pt-6"
                  >
                    <div class="na:min-w-0">
                      <h2 class="na:m-0 na:text-sm na:font-semibold">{{ t('security.email') }}</h2>
                      <p class="na:mt-2 na:mb-0 na:break-all" :class="muted">
                        {{ snapshot.email }}
                      </p>
                    </div>
                    <NovaButton
                      v-if="simulated"
                      variant="secondary"
                      :disabled="busy"
                      @click="openModal('email')"
                      >{{ t('common.change') }}</NovaButton
                    >
                  </div>
                  <div
                    v-if="showTwoStep"
                    class="na:flex na:items-center na:justify-between na:gap-4 na:border-t na:border-[var(--na-line)] na:pt-6"
                  >
                    <div>
                      <h2 class="na:m-0 na:text-sm na:font-semibold">
                        {{ t('security.twoStep') }}
                      </h2>
                      <p class="na:mt-2 na:mb-0" :class="muted">
                        {{
                          snapshot.security.twoStepEnabled
                            ? t('security.enabled')
                            : t('security.disabled')
                        }}{{ simulated ? t('security.demoSuffix') : '' }}
                      </p>
                    </div>
                    <NovaButton
                      v-if="simulated"
                      variant="secondary"
                      :disabled="busy"
                      @click="openModal('twoStep')"
                      >{{
                        snapshot.security.twoStepEnabled ? t('common.close') : t('common.enable')
                      }}</NovaButton
                    >
                  </div>
                </div>
                <p :class="muted">{{ simulated ? t('security.demo') : t('security.slot') }}</p>
              </slot>
            </div>
            <section :class="panel" class="nova-security-activity">
              <h2 class="na:mt-0 na:mb-5 na:text-base na:font-semibold">
                {{ t('security.activity') }}
              </h2>
              <div
                role="group"
                :aria-label="t('security.filter')"
                class="na:mb-4 na:flex na:flex-wrap na:gap-2"
              >
                <NovaButton
                  v-for="filter in filterOptions"
                  :key="filter.value"
                  :variant="activityFilter === filter.value ? 'primary' : 'secondary'"
                  :aria-pressed="activityFilter === filter.value"
                  @click="activityFilter = filter.value"
                  >{{ filter.label }}</NovaButton
                >
              </div>
              <ul class="na:m-0 na:list-none na:p-0">
                <li
                  v-for="entry in visibleActivities"
                  :key="entry.id"
                  class="na:border-t na:border-[var(--na-line)] na:py-4"
                >
                  <div class="na:flex na:flex-wrap na:justify-between na:gap-2">
                    <strong class="na:text-sm na:font-medium">{{ entry.title }}</strong
                    ><time class="na:text-xs na:text-[var(--na-muted)]" :datetime="entry.at">{{
                      formatTime(entry.at)
                    }}</time>
                  </div>
                  <p class="na:mt-1 na:mb-0" :class="muted">{{ entry.description }}</p>
                </li>
              </ul>
              <p v-if="!visibleActivities.length" :class="muted">{{ t('security.empty') }}</p>
              <div class="na:mt-3 na:flex na:items-center na:justify-between">
                <span class="na:text-xs na:text-[var(--na-muted)]"
                  >{{ activityPage + 1 }} / {{ activityPages }}</span
                >
                <div class="na:flex na:gap-2">
                  <NovaButton
                    variant="secondary"
                    :aria-label="t('security.previous')"
                    :disabled="activityPage === 0"
                    @click="activityPage--"
                    ><NovaIcon name="back" :size="16" /></NovaButton
                  ><NovaButton
                    variant="secondary"
                    :aria-label="t('security.next')"
                    :disabled="activityPage >= activityPages - 1"
                    @click="activityPage++"
                    ><NovaIcon name="forward" :size="16"
                  /></NovaButton>
                </div>
              </div>
            </section>
          </section>

          <section v-else-if="page === 'devices'" class="na:space-y-5">
            <div :class="panel" class="nova-devices">
              <div
                class="nova-device-heading na:flex na:flex-wrap na:items-center na:justify-between na:gap-4"
              >
                <div>
                  <h2 class="na:m-0 na:text-sm na:font-semibold">{{ t('devices.list') }}</h2>
                  <p class="na:mt-2" :class="muted">
                    {{ t('devices.count', { count: snapshot.devices.length }) }}
                  </p>
                </div>
                <NovaButton
                  variant="secondary"
                  :disabled="busy || !snapshot.devices.some((device) => !device.current)"
                  @click="openModal('revokeAll')"
                  >{{ t('devices.revokeAll') }}</NovaButton
                >
              </div>
              <div class="nova-device-grid">
                <article
                  v-for="device in snapshot.devices"
                  :key="device.id"
                  class="nova-device-card na:flex na:flex-wrap na:items-center na:gap-4 na:border-b na:border-[var(--na-line)] na:py-5 na:last:border-b-0"
                >
                  <span
                    class="na:flex na:size-11 na:items-center na:justify-center na:rounded-xl na:bg-[var(--na-soft)] na:text-lg na:text-[var(--na-brand)]"
                    aria-hidden="true"
                    ><NovaIcon
                      :name="device.platform.toLowerCase().includes('ios') ? 'phone' : 'devices'"
                  /></span>
                  <div class="na:min-w-0 na:flex-1">
                    <h3 class="na:m-0 na:text-sm na:font-semibold">{{ device.name }}</h3>
                    <p class="na:my-1" :class="muted">
                      {{ device.platform }} · {{ device.location }}
                    </p>
                  </div>
                  <time
                    :datetime="device.lastActiveAt"
                    class="na:text-xs na:text-[var(--na-muted)]"
                  >
                    {{ t('devices.lastActive', { time: formatTime(device.lastActiveAt) }) }}
                  </time>
                  <span
                    v-if="device.current"
                    class="na:rounded-lg na:bg-[var(--na-soft)] na:px-3 na:py-2 na:text-xs na:text-[var(--na-brand)]"
                    >{{ t('devices.current') }}</span
                  ><NovaButton
                    v-else
                    variant="ghost"
                    :disabled="busy"
                    :aria-label="t('devices.revokeLabel', { name: device.name })"
                    @click="openModal('revoke', device.id)"
                    >{{ t('devices.revoke') }}</NovaButton
                  >
                </article>
              </div>
            </div>
            <p v-if="simulated" :class="muted">{{ t('devices.demo') }}</p>
          </section>

          <form
            v-else-if="page === 'notifications'"
            class="nova-notification-layout na:space-y-5"
            @submit.prevent="saveNotifications"
          >
            <div :class="panel" class="nova-notification-options">
              <label
                v-for="option in preferenceOptions"
                :key="option.key"
                class="na:flex na:cursor-pointer na:items-center na:justify-between na:gap-5 na:border-b na:border-[var(--na-line)] na:py-6 na:last:border-b-0"
                ><span
                  ><strong class="na:block na:text-sm na:font-semibold">{{ option.label }}</strong
                  ><span class="na:mt-1 na:block" :class="muted">{{
                    option.description
                  }}</span></span
                ><input
                  v-model="notifications[option.key]"
                  type="checkbox"
                  role="switch"
                  :aria-label="option.label"
                  :disabled="busy"
                  class="na:h-6 na:w-11 na:shrink-0 na:cursor-pointer na:accent-[var(--na-brand)]"
              /></label>
            </div>
            <aside class="nova-notification-preview" :class="panel">
              <div class="nova-preview-heading">
                <NovaIcon name="notifications" />
                <div>
                  <h2>{{ t('notifications.preview') }}</h2>
                  <p>{{ t('notifications.previewHint') }}</p>
                </div>
              </div>
              <div class="nova-notification-previews">
                <article
                  v-for="option in preferenceOptions.filter((item) => notifications[item.key])"
                  :key="option.key"
                >
                  <NovaIcon
                    :name="
                      option.key === 'security'
                        ? 'security'
                        : option.key === 'email'
                          ? 'messages'
                          : 'notifications'
                    "
                  />
                  <div>
                    <h3>{{ option.label }}</h3>
                    <p>{{ option.description }}</p>
                  </div>
                  <NovaIcon name="check" :size="16" />
                </article>
                <p
                  v-if="!preferenceOptions.some((item) => notifications[item.key])"
                  class="nova-preview-empty"
                >
                  {{ t('notifications.previewEmpty') }}
                </p>
              </div>
            </aside>
            <p v-if="simulated" :class="muted">{{ t('notifications.demo') }}</p>
            <div
              data-account-savebar
              class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4"
            >
              <p role="status" class="na:m-0 na:text-xs na:text-[var(--na-muted)]">
                {{ dirty ? t('profile.dirty') : t('profile.clean') }}
              </p>
              <div class="na:flex na:gap-3">
                <NovaButton variant="secondary" @click="discardDraft">{{
                  t('common.cancel')
                }}</NovaButton
                ><NovaButton variant="primary" type="submit" :disabled="!dirty || busy"
                  ><NovaIcon v-if="!busy" name="save" :size="16" />{{
                    busy ? t('common.saving') : t('notifications.save')
                  }}</NovaButton
                >
              </div>
            </div>
          </form>

          <section v-else-if="page === 'messages'" class="nova-message-page na:space-y-5">
            <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4">
              <div role="group" :aria-label="t('messages.filter')" class="na:flex na:gap-2">
                <NovaButton
                  :variant="messageFilter === 'all' ? 'primary' : 'secondary'"
                  :aria-pressed="messageFilter === 'all'"
                  @click="messageFilter = 'all'"
                  >{{ t('messages.all') }}</NovaButton
                ><NovaButton
                  :variant="messageFilter === 'unread' ? 'primary' : 'secondary'"
                  :aria-pressed="messageFilter === 'unread'"
                  @click="messageFilter = 'unread'"
                  >{{ t('messages.unread') }} {{ unread }}</NovaButton
                >
              </div>
              <NovaButton
                variant="secondary"
                :disabled="busy || !unread"
                @click="
                  mutate((context) => adapter.markAllMessagesRead(context), t('messages.allMarked'))
                "
                >{{ t('messages.markAll') }}</NovaButton
              >
            </div>
            <div
              class="nova-message-workspace na:grid na:gap-6"
              :class="
                readerWide ? 'is-wide na:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]' : undefined
              "
            >
              <div :class="panel" class="nova-message-list">
                <article
                  v-for="message in visibleMessages"
                  :key="message.id"
                  :data-message-read="message.read"
                  :data-message-selected="selectedMessageId === message.id"
                  class="na:flex na:flex-wrap na:items-start na:gap-3 na:border-b na:border-[var(--na-line)] na:py-5 na:last:border-b-0"
                >
                  <span
                    class="na:mt-3 na:size-1.5 na:shrink-0 na:rounded-full"
                    :class="message.read ? 'na:bg-transparent' : 'na:bg-[var(--na-brand)]'"
                    aria-hidden="true"
                  ></span
                  ><button
                    type="button"
                    :disabled="busy"
                    class="na:min-w-36 na:flex-1 na:border-0 na:bg-transparent na:p-0 na:text-left"
                    @click="openMessage(message.id)"
                  >
                    <span class="na:sr-only"
                      >{{ message.read ? t('messages.read') : t('messages.unread') }}:
                    </span>
                    <span class="na:text-xs na:text-[var(--na-brand)]">{{
                      {
                        security: t('messages.security'),
                        product: t('messages.product'),
                        account: t('messages.account'),
                      }[message.category]
                    }}</span>
                    <h2 class="na:mt-2 na:mb-1 na:text-sm na:font-semibold">{{ message.title }}</h2>
                    <p class="na:my-1" :class="muted">{{ message.summary }}</p>
                    <time
                      :datetime="message.createdAt"
                      class="na:mt-2 na:block na:text-xs na:text-[var(--na-muted)]"
                      >{{ formatTime(message.createdAt) }}</time
                    ><span class="na:sr-only">{{ t('messages.viewDetails') }}</span></button
                  ><NovaButton
                    v-if="!message.read"
                    variant="ghost"
                    :disabled="busy"
                    @click="markRead(message.id)"
                    >{{ t('messages.mark') }}</NovaButton
                  >
                </article>
                <div v-if="!visibleMessages.length" class="na:py-12 na:text-center">
                  <span class="na:text-2xl na:text-[var(--na-brand)]" aria-hidden="true">✓</span>
                  <h2 class="na:mt-4 na:text-base na:font-semibold">
                    {{ t('messages.emptyTitle') }}
                  </h2>
                  <p :class="muted">{{ t('messages.empty') }}</p>
                </div>
              </div>
              <aside
                v-if="readerWide"
                class="nova-message-reader"
                :class="panel"
                :aria-label="t('messages.detail')"
              >
                <template v-if="selectedMessage"
                  ><span class="nova-reader-category">{{
                    {
                      security: t('messages.security'),
                      product: t('messages.product'),
                      account: t('messages.account'),
                    }[selectedMessage.category]
                  }}</span>
                  <h2>{{ selectedMessage.title }}</h2>
                  <time :datetime="selectedMessage.createdAt">{{
                    formatTime(selectedMessage.createdAt)
                  }}</time>
                  <p
                    class="nova-reader-body na:whitespace-pre-wrap na:break-words na:text-sm na:leading-7"
                  >
                    {{ selectedMessage.body }}
                  </p>
                  <NovaButton variant="ghost" @click="modal = 'message'">{{
                    t('messages.openDialog')
                  }}</NovaButton></template
                >
                <div v-else class="nova-reader-empty na:grid na:gap-4 na:py-12">
                  <NovaIcon name="messages" :size="40" />
                  <h2>{{ t('messages.choose') }}</h2>
                  <p>{{ t('messages.chooseHint') }}</p>
                </div>
              </aside>
            </div>
          </section>
          <section v-else-if="page === 'appearance'" :class="panel">
            <slot name="appearance"
              ><p :class="muted">{{ t('appearance.slot') }}</p></slot
            >
          </section>
        </template>
        <div v-if="snapshot && $slots.page && page" v-show="page?.startsWith('custom:')">
          <slot
            name="page"
            :page="page"
            :snapshot="snapshot"
            :adapter="adapter"
            :refresh="refresh"
          />
        </div>
      </div>
    </main>

    <NovaDialog :open="queued !== null" :title="t('guard.title')" @close="queued = null"
      ><p :class="muted">{{ t('guard.description') }}</p>
      <div class="na:mt-6 na:flex na:flex-wrap na:justify-end na:gap-3">
        <NovaButton variant="secondary" @click="queued = null">{{ t('guard.stay') }}</NovaButton
        ><NovaButton variant="primary" @click="discardAndNavigate">{{
          t('guard.leave')
        }}</NovaButton>
      </div></NovaDialog
    >
    <NovaDialog :open="modal !== null" :title="modalTitle" @close="closeModal">
      <template v-if="modal === 'message' && selectedMessage"
        ><p class="na:mt-0 na:text-xs na:text-[var(--na-muted)]">
          {{ formatTime(selectedMessage.createdAt) }}
        </p>
        <p class="na:whitespace-pre-wrap na:break-words na:text-sm na:leading-7">
          {{ selectedMessage.body }}
        </p>
        <p v-if="error" role="alert" class="na:text-sm na:text-[var(--na-error)]">
          {{ error }}
        </p></template
      >
      <form v-else class="na:space-y-4" @submit.prevent="submitSecurity">
        <p v-if="simulated" :class="muted" class="na:mt-0">{{ t('security.formDemo') }}</p>
        <template v-if="modal === 'password' || modal === 'email' || modal === 'twoStep'">
          <NovaField
            v-model="securityValues.currentPassword"
            :label="t('security.currentPassword')"
            type="password"
            autocomplete="off"
            :disabled="busy"
          />
          <template v-if="modal === 'password'"
            ><NovaField
              v-model="securityValues.newPassword"
              :label="t('auth.newPassword')"
              type="password"
              autocomplete="off"
              :disabled="busy" /><NovaField
              v-model="securityValues.confirmPassword"
              :label="t('auth.confirmPassword')"
              type="password"
              autocomplete="off"
              :disabled="busy"
          /></template>
          <template v-if="modal === 'email'"
            ><NovaField
              v-model="securityValues.email"
              :label="t('security.newEmail')"
              type="email"
              autocomplete="off"
              :disabled="busy"
            />
            <div class="na:flex na:items-end na:gap-3">
              <div class="na:min-w-0 na:flex-1">
                <NovaField
                  v-model="securityValues.code"
                  :label="t('security.emailCode')"
                  :maxlength="6"
                  autocomplete="off"
                  :disabled="busy || !codeSent"
                />
              </div>
              <NovaButton
                variant="secondary"
                :disabled="busy || !securityValues.email || !securityValues.currentPassword"
                @click="sendEmailCode"
                >{{ busy ? t('common.processingShort') : t('security.getDemoCode') }}</NovaButton
              >
            </div>
            <p v-if="codeSent" role="status" :class="muted">
              {{ demoCode ? t('security.demoCode', { code: demoCode }) : t('security.codeSent') }}
            </p></template
          >
          <template v-if="modal === 'twoStep'"
            ><p :class="muted">{{ t('security.confirmationHelp') }}</p>
            <NovaField
              v-model="securityValues.code"
              :label="t('security.confirmationCode')"
              autocomplete="off"
              :disabled="busy"
          /></template>
          <slot name="securityFormTools" :fill="fillSecurity" />
        </template>
        <p v-else :class="muted">
          {{ modal === 'revokeAll' ? t('devices.keepCurrent') : t('devices.confirmSession') }}
        </p>
        <p v-if="error" role="alert" class="na:text-sm na:text-[var(--na-error)]">{{ error }}</p>
        <div class="na:flex na:justify-end na:gap-3 na:pt-2">
          <NovaButton variant="secondary" @click="closeModal">{{ t('common.cancel') }}</NovaButton
          ><NovaButton
            variant="primary"
            type="submit"
            :disabled="busy || (modal === 'email' && !codeSent)"
            >{{
              busy
                ? t('common.processingShort')
                : simulated
                  ? t('security.confirmDemo')
                  : t('common.confirm')
            }}</NovaButton
          >
        </div>
      </form>
    </NovaDialog>
  </div>
</template>
