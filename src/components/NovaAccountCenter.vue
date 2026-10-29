<script setup lang="ts">
import { useNovaLocale } from '../locale'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type {
  AccountAdapter,
  AccountPage,
  AccountSnapshot,
  NotificationPreferences,
  Profile,
} from '../types'
import { useAccount } from '../composables/useAccount'
import NovaButton from './NovaButton.vue'
import NovaField from './NovaField.vue'
import NovaDialog from './NovaDialog.vue'

const { t, formatTime } = useNovaLocale()
const props = defineProps<{
  adapter: AccountAdapter
  simulated?: boolean
  page?: AccountPage
  initialPage?: AccountPage
}>()
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
  appearance(): unknown
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
const internalPage = ref<AccountPage>(props.initialPage ?? 'overview')
const page = computed(() => props.page ?? internalPage.value)
const heading = ref<HTMLElement>()
const queued = ref<AccountPage | 'logout' | null>(null)
const profile = reactive<Omit<Profile, 'id'>>({ nickname: '', bio: '', avatar: 'iris' })
const notifications = reactive<NotificationPreferences>({
  product: false,
  email: false,
  security: true,
})
const tabs = computed<{ id: AccountPage; label: string; symbol: string; description: string }[]>(
  () => [
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
  ],
)
const currentTab = computed(() => tabs.value.find((tab) => tab.id === page.value)!)
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
})
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))

function requestNavigation(target: AccountPage | 'logout') {
  if (target === page.value) return
  if (dirty.value) {
    queued.value = target
    return
  }
  navigate(target)
}
function navigate(target: AccountPage | 'logout') {
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
  modal.value = 'message'
  void markRead(messageId)
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
  else if (action === 'twoStep' && snapshot.value) {
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
  emit('pageChange', target)
  void nextTick(() => heading.value?.focus({ preventScroll: true }))
})
watch(
  () => props.adapter,
  () => {
    closeModal()
    clear()
    queued.value = null
    internalPage.value = props.initialPage ?? 'overview'
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
      <nav
        :aria-label="t('account.navigation')"
        class="na:flex na:gap-1 na:overflow-x-auto na:p-3 na:md:flex-col na:md:px-4 na:md:py-0"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
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
          <span class="na:hidden na:w-4 na:text-center na:md:inline" aria-hidden="true">{{
            tab.symbol
          }}</span
          ><span>{{ tab.label }}</span
          ><span
            v-if="tab.id === 'messages' && unread"
            class="na:rounded-full na:bg-[var(--na-soft)] na:px-1.5 na:text-xs na:text-[var(--na-brand)]"
            :aria-label="t('account.unreadCount', { count: unread })"
            >{{ unread }}</span
          >
        </button>
        <button
          type="button"
          class="na:shrink-0 na:rounded-xl na:border-0 na:bg-transparent na:px-4 na:py-3 na:text-left na:text-sm na:text-[var(--na-muted)] na:hover:bg-[var(--na-soft)] na:md:mt-6 na:md:border-t na:md:border-[var(--na-line)]"
          @click="requestNavigation('logout')"
        >
          {{ t('account.logout') }}
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
      class="na:min-h-0 na:min-w-0 na:flex-1 na:overflow-y-auto na:bg-[var(--na-canvas)] na:p-5 na:sm:p-8 na:lg:p-12"
      :aria-busy="busy"
    >
      <div class="na:mx-auto na:w-full na:max-w-6xl">
        <header class="na:mb-7 na:flex na:flex-wrap na:items-start na:justify-between na:gap-4">
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
          <section v-if="page === 'overview'" class="na:space-y-6">
            <div :class="panel" class="na:flex na:flex-wrap na:items-center na:gap-5">
              <div
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
              <NovaButton variant="secondary" @click="requestNavigation('profile')">{{
                t('account.editProfile')
              }}</NovaButton>
            </div>
            <div class="na:grid na:grid-cols-1 na:gap-4 na:sm:grid-cols-2 na:xl:grid-cols-4">
              <button
                v-for="tab in tabs.filter((item) =>
                  ['profile', 'security', 'devices', 'notifications'].includes(item.id),
                )"
                :key="tab.id"
                type="button"
                :class="panel"
                class="na:flex na:items-center na:gap-4 na:text-left na:hover:border-[var(--na-brand)]"
                @click="requestNavigation(tab.id)"
              >
                <span class="na:text-xl na:text-[var(--na-brand)]" aria-hidden="true">{{
                  tab.symbol
                }}</span>
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
                <span class="na:ml-auto na:text-[var(--na-muted)]" aria-hidden="true">→</span>
              </button>
            </div>
            <section :class="panel">
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
          </section>

          <form
            v-else-if="page === 'profile'"
            class="na:max-w-3xl na:space-y-5"
            @submit.prevent="saveProfile"
          >
            <section :class="panel" class="na:space-y-6">
              <fieldset class="na:m-0 na:border-0 na:p-0" :disabled="busy">
                <legend class="na:mb-3 na:text-sm na:font-medium">
                  {{ t('profile.avatars') }}
                </legend>
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
              </fieldset>
              <NovaField
                v-model="profile.nickname"
                :label="t('profile.nickname')"
                :maxlength="24"
                autocomplete="nickname"
                :disabled="busy"
              />
              <p class="na:-mt-4 na:text-xs na:text-[var(--na-muted)]">
                {{ t('profile.count', { count: profile.nickname.length, max: 24 }) }}
              </p>
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
            </section>
            <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4">
              <p role="status" class="na:m-0 na:text-xs na:text-[var(--na-muted)]">
                {{ dirty ? t('profile.dirty') : t('profile.clean') }}
              </p>
              <div class="na:flex na:gap-3">
                <NovaButton variant="secondary" @click="discardDraft">{{
                  t('common.cancel')
                }}</NovaButton
                ><NovaButton variant="primary" type="submit" :disabled="!dirty || busy">{{
                  busy ? t('common.saving') : t('profile.save')
                }}</NovaButton>
              </div>
            </div>
          </form>

          <section v-else-if="page === 'security'" class="na:space-y-6">
            <slot name="security" :snapshot="snapshot" :adapter="adapter" :refresh="refresh">
              <div :class="panel" class="na:space-y-6">
                <div class="na:flex na:items-center na:justify-between na:gap-4">
                  <div>
                    <h2 class="na:m-0 na:text-sm na:font-semibold">{{ t('security.password') }}</h2>
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
                    <p class="na:mt-2 na:mb-0 na:break-all" :class="muted">{{ snapshot.email }}</p>
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
                  class="na:flex na:items-center na:justify-between na:gap-4 na:border-t na:border-[var(--na-line)] na:pt-6"
                >
                  <div>
                    <h2 class="na:m-0 na:text-sm na:font-semibold">{{ t('security.twoStep') }}</h2>
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
            <section :class="panel">
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
                    >←</NovaButton
                  ><NovaButton
                    variant="secondary"
                    :aria-label="t('security.next')"
                    :disabled="activityPage >= activityPages - 1"
                    @click="activityPage++"
                    >→</NovaButton
                  >
                </div>
              </div>
            </section>
          </section>

          <section v-else-if="page === 'devices'" class="na:space-y-5">
            <div class="na:flex na:justify-end">
              <NovaButton
                variant="secondary"
                :disabled="busy || !snapshot.devices.some((device) => !device.current)"
                @click="openModal('revokeAll')"
                >{{ t('devices.revokeAll') }}</NovaButton
              >
            </div>
            <div :class="panel">
              <article
                v-for="device in snapshot.devices"
                :key="device.id"
                class="na:flex na:flex-wrap na:items-center na:gap-4 na:border-b na:border-[var(--na-line)] na:py-5 na:last:border-b-0"
              >
                <span
                  class="na:flex na:size-11 na:items-center na:justify-center na:rounded-xl na:bg-[var(--na-soft)] na:text-lg na:text-[var(--na-brand)]"
                  aria-hidden="true"
                  >▣</span
                >
                <div class="na:min-w-0 na:flex-1">
                  <h2 class="na:m-0 na:text-sm na:font-semibold">{{ device.name }}</h2>
                  <p class="na:my-1" :class="muted">
                    {{ device.platform }} · {{ device.location }}
                  </p>
                  <p class="na:m-0 na:text-xs na:text-[var(--na-muted)]">
                    {{ t('devices.lastActive', { time: formatTime(device.lastActiveAt) }) }}
                  </p>
                </div>
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
            <p v-if="simulated" :class="muted">{{ t('devices.demo') }}</p>
          </section>

          <form
            v-else-if="page === 'notifications'"
            class="na:max-w-3xl na:space-y-5"
            @submit.prevent="saveNotifications"
          >
            <div :class="panel">
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
            <p v-if="simulated" :class="muted">{{ t('notifications.demo') }}</p>
            <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4">
              <p role="status" class="na:m-0 na:text-xs na:text-[var(--na-muted)]">
                {{ dirty ? t('profile.dirty') : t('profile.clean') }}
              </p>
              <div class="na:flex na:gap-3">
                <NovaButton variant="secondary" @click="discardDraft">{{
                  t('common.cancel')
                }}</NovaButton
                ><NovaButton variant="primary" type="submit" :disabled="!dirty || busy">{{
                  busy ? t('common.saving') : t('notifications.save')
                }}</NovaButton>
              </div>
            </div>
          </form>

          <section v-else-if="page === 'messages'" class="na:space-y-5">
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
            <div :class="panel">
              <article
                v-for="message in visibleMessages"
                :key="message.id"
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
          </section>
          <section v-else-if="page === 'appearance'" :class="panel">
            <slot name="appearance"
              ><p :class="muted">{{ t('appearance.slot') }}</p></slot
            >
          </section>
        </template>
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
