<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, useId, watch } from 'vue'
import type { AccountAdapter, AccountPage, AccountSnapshot, Activity, NotificationPreferences, Profile } from '../types'
import { useAccount } from '../composables/useAccount'
import NovaButton from './NovaButton.vue'
import NovaField from './NovaField.vue'
import NovaDialog from './NovaDialog.vue'

const props = defineProps<{ adapter: AccountAdapter; simulated?: boolean }>()
const emit = defineEmits<{ logout: []; pageChange: [page: AccountPage] }>()
type SecurityValues = { currentPassword: string; newPassword: string; confirmPassword: string; email: string; code: string }
defineSlots<{
  appearance(): unknown
  security(props: { snapshot: AccountSnapshot; adapter: AccountAdapter; refresh: () => Promise<AccountSnapshot | undefined> }): unknown
  securityFormTools(props: { fill: (values: Partial<SecurityValues>) => void }): unknown
}>()
const { snapshot, busy, error, notice, unread, request, load, mutate, cancel, clear } = useAccount(() => props.adapter)
const id = useId()
const page = ref<AccountPage>('overview')
const heading = ref<HTMLElement>()
const queued = ref<AccountPage | 'logout' | null>(null)
const profile = reactive<Omit<Profile, 'id'>>({ nickname: '', bio: '', avatar: 'iris' })
const notifications = reactive<NotificationPreferences>({ product: false, email: false, security: true })
const tabs: { id: AccountPage; label: string; symbol: string; description: string }[] = [
  { id: 'overview', label: '账户概览', symbol: '◈', description: '属于你的账户空间。' },
  { id: 'profile', label: '个人资料', symbol: '◇', description: '让大家更好地认识你。' },
  { id: 'security', label: '账号安全', symbol: '♧', description: '管理登录凭据与安全选项。' },
  { id: 'devices', label: '登录设备', symbol: '▣', description: '查看和管理账户的登录设备。' },
  { id: 'notifications', label: '通知偏好', symbol: '♧', description: '保留重要的，减少打扰。' },
  { id: 'messages', label: '消息中心', symbol: '✉', description: '账户的重要消息，在这里查看。' },
  { id: 'appearance', label: '外观设置', symbol: '◐', description: '选一种看起来舒服的方式。' },
]
const currentTab = computed(() => tabs.find(tab => tab.id === page.value)!)
const avatarOptions: { id: Profile['avatar']; label: string; color: string }[] = [
  { id: 'iris', label: '鸢尾紫', color: '#6958c5' }, { id: 'teal', label: '湖水绿', color: '#217560' },
  { id: 'sun', label: '暖阳橙', color: '#956100' }, { id: 'graphite', label: '石墨灰', color: '#636172' },
]
const preferenceOptions: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'product', label: '产品动态', description: '新功能与体验更新' },
  { key: 'email', label: '邮件摘要', description: '周期性账户与内容摘要' },
  { key: 'security', label: '安全提醒', description: '新设备登录和安全资料变更' },
]
const panel = 'na:rounded-2xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:p-5 na:sm:p-7'
const muted = 'na:text-sm na:leading-6 na:text-[var(--na-muted)]'
const dirty = computed(() => {
  if (!snapshot.value) return false
  if (page.value === 'profile') return profile.nickname !== snapshot.value.profile.nickname || profile.bio !== snapshot.value.profile.bio || profile.avatar !== snapshot.value.profile.avatar
  if (page.value === 'notifications') return preferenceOptions.some(option => notifications[option.key] !== snapshot.value!.notifications[option.key])
  return false
})
function syncDrafts() {
  if (!snapshot.value) return
  const { id: _id, ...rest } = snapshot.value.profile
  Object.assign(profile, rest)
  Object.assign(notifications, snapshot.value.notifications)
}
async function refresh() { const result = await load(); if (result) syncDrafts(); return result }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => { void refresh(); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))

function requestNavigation(target: AccountPage | 'logout') {
  if (target === page.value) return
  if (dirty.value) { queued.value = target; return }
  navigate(target)
}
function navigate(target: AccountPage | 'logout') {
  cancel()
  closeModal()
  queued.value = null
  notice.value = ''
  if (target === 'logout') { emit('logout'); return }
  page.value = target
  syncDrafts()
  emit('pageChange', target)
  void nextTick(() => heading.value?.focus({ preventScroll: true }))
}
function discardAndNavigate() { if (queued.value) navigate(queued.value) }
function discardDraft() { cancel(); syncDrafts() }
async function saveProfile() {
  if (!dirty.value) return
  const result = await mutate(context => props.adapter.updateProfile({ ...profile }, context), props.simulated ? '演示资料已保存，仅保留在本页。' : '个人资料已保存。')
  if (result) syncDrafts()
}
async function saveNotifications() {
  if (!dirty.value) return
  const result = await mutate(context => props.adapter.updateNotifications({ ...notifications }, context), props.simulated ? '演示偏好已保存，不会发送真实通知。' : '通知偏好已保存。')
  if (result) syncDrafts()
}
const messageFilter = ref<'all' | 'unread'>('all')
const visibleMessages = computed(() => snapshot.value?.messages.filter(message => messageFilter.value === 'all' || !message.read) ?? [])
const selectedMessageId = ref('')
const selectedMessage = computed(() => snapshot.value?.messages.find(message => message.id === selectedMessageId.value))
async function markRead(messageId: string) { await mutate(context => props.adapter.markMessageRead(messageId, context), '消息已标为已读。') }
function openMessage(messageId: string) { modalEpoch++; selectedMessageId.value = messageId; modal.value = 'message'; void markRead(messageId) }
const activityFilter = ref<'all' | 'credentials' | 'devices'>('all')
const activityPage = ref(0)
const securityActivities = computed(() => snapshot.value?.activity.filter(item => item.category !== 'account' && (activityFilter.value === 'all' || item.category === activityFilter.value)) ?? [])
const activityPages = computed(() => Math.max(1, Math.ceil(securityActivities.value.length / 4)))
const visibleActivities = computed(() => securityActivities.value.slice(activityPage.value * 4, activityPage.value * 4 + 4))
watch(activityFilter, () => { activityPage.value = 0 })
watch(activityPages, pages => { activityPage.value = Math.min(activityPage.value, pages - 1) })
const filterOptions: { value: 'all' | 'credentials' | 'devices'; label: string }[] = [{ value: 'all', label: '全部' }, { value: 'credentials', label: '凭据' }, { value: 'devices', label: '设备' }]
function formatTime(value: string) { return value.replace('T', ' ').slice(0, 16) + ' UTC' }

type Modal = 'password' | 'email' | 'twoStep' | 'revoke' | 'revokeAll' | 'message' | null
const modal = ref<Modal>(null)
let modalEpoch = 0
const deviceId = ref('')
const securityValues = reactive<SecurityValues>({ currentPassword: '', newPassword: '', confirmPassword: '', email: '', code: '' })
const codeSent = ref(false)
const demoCode = ref('')
const modalTitle = computed(() => ({ password: '修改密码', email: '更换邮箱', twoStep: '两步验证演示', revoke: '退出此设备？', revokeAll: '退出其他设备？', message: selectedMessage.value?.title ?? '消息详情' })[modal.value ?? 'message'])
function clearSecurity() { Object.assign(securityValues, { currentPassword: '', newPassword: '', confirmPassword: '', email: '', code: '' }); codeSent.value = false; demoCode.value = '' }
function closeModal() { modalEpoch++; cancel(); modal.value = null; selectedMessageId.value = ''; clearSecurity() }
function openModal(kind: Modal, targetDevice = '') { modalEpoch++; cancel(); clearSecurity(); modal.value = kind; deviceId.value = targetDevice }
function fillSecurity(values: Partial<SecurityValues>) { Object.assign(securityValues, values) }
watch(() => [securityValues.email, securityValues.currentPassword], () => {
  if (modal.value === 'email') { modalEpoch++; cancel(); codeSent.value = false; demoCode.value = ''; securityValues.code = '' }
}, { flush: 'sync' })
async function sendEmailCode() {
  const epoch = modalEpoch
  const input = { email: securityValues.email, currentPassword: securityValues.currentPassword }
  const result = await request(context => props.adapter.requestEmailChangeCode(input, context))
  if (result && modal.value === 'email' && epoch === modalEpoch && input.email === securityValues.email && input.currentPassword === securityValues.currentPassword) { codeSent.value = true; demoCode.value = props.simulated ? result.demoCode ?? '' : '' }
}
async function submitSecurity() {
  const epoch = modalEpoch
  const input = { ...securityValues }
  const action = modal.value
  let result: AccountSnapshot | undefined
  if (action === 'password') result = await mutate(context => props.adapter.changePassword(input, context), '密码修改演示已完成；登录示例不变。')
  else if (action === 'email' && codeSent.value) result = await mutate(context => props.adapter.changeEmail({ email: input.email, code: input.code }, context), '邮箱更换演示已完成；登录示例不变。')
  else if (action === 'twoStep' && snapshot.value) {
    const enabled = !snapshot.value.security.twoStepEnabled
    result = await mutate(context => props.adapter.setTwoStep({ enabled, currentPassword: input.currentPassword, code: input.code }, context), '两步验证演示状态已更新；这不是真实安全保护。')
  } else if (action === 'revoke') result = await mutate(context => props.adapter.revokeDevice(deviceId.value, context), props.simulated ? '已移除示例设备，不影响真实会话。' : '设备会话已退出。')
  else if (action === 'revokeAll') result = await mutate(context => props.adapter.revokeOtherDevices(context), props.simulated ? '其他示例设备已移除。' : '其他设备会话已退出。')
  if (result && epoch === modalEpoch) closeModal()
}
watch(() => props.adapter, () => {
  closeModal(); clear(); queued.value = null; page.value = 'overview'
  void refresh()
})
defineExpose({ refresh, fillSecurity })
</script>

<template>
  <div class="na:flex na:min-h-0 na:w-full na:flex-1 na:flex-col na:md:flex-row" data-nova-account-center>
    <aside class="na:flex na:shrink-0 na:flex-col na:border-b na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:md:w-60 na:md:overflow-y-auto na:md:border-r na:md:border-b-0">
      <div v-if="snapshot" class="na:hidden na:items-center na:gap-3 na:px-6 na:py-8 na:md:flex">
        <span class="na:flex na:size-11 na:shrink-0 na:items-center na:justify-center na:rounded-2xl na:bg-[var(--na-soft)] na:text-lg na:font-medium na:text-[var(--na-brand)]" aria-hidden="true">{{ snapshot.profile.nickname.slice(0, 1).toUpperCase() }}</span>
        <div class="na:min-w-0"><strong class="na:block na:truncate na:text-sm na:font-semibold">{{ snapshot.profile.nickname }}</strong><span class="na:mt-1 na:block na:text-xs na:text-[var(--na-muted)]">个人账户{{ simulated ? ' · 演示' : '' }}</span></div>
      </div>
      <nav aria-label="用户中心导航" class="na:flex na:gap-1 na:overflow-x-auto na:p-3 na:md:flex-col na:md:px-4 na:md:py-0">
        <button v-for="tab in tabs" :key="tab.id" type="button" :aria-current="page === tab.id ? 'page' : undefined" :data-page="tab.id" class="na:flex na:shrink-0 na:items-center na:gap-3 na:rounded-xl na:border-0 na:px-4 na:py-3 na:text-left na:text-sm na:transition-colors na:hover:bg-[var(--na-soft)]" :class="page === tab.id ? 'na:bg-[var(--na-soft)] na:font-medium na:text-[var(--na-brand)]' : 'na:bg-transparent na:text-[var(--na-muted)]'" @click="requestNavigation(tab.id)">
          <span class="na:hidden na:w-4 na:text-center na:md:inline" aria-hidden="true">{{ tab.symbol }}</span><span>{{ tab.label }}</span><span v-if="tab.id === 'messages' && unread" class="na:rounded-full na:bg-[var(--na-soft)] na:px-1.5 na:text-xs na:text-[var(--na-brand)]" :aria-label="`${unread} 条未读`">{{ unread }}</span>
        </button>
        <button type="button" class="na:shrink-0 na:rounded-xl na:border-0 na:bg-transparent na:px-4 na:py-3 na:text-left na:text-sm na:text-[var(--na-muted)] na:hover:bg-[var(--na-soft)] na:md:mt-6 na:md:border-t na:md:border-[var(--na-line)]" @click="requestNavigation('logout')">↗ 退出登录</button>
      </nav>
      <p v-if="simulated" class="na:mt-auto na:hidden na:px-7 na:py-6 na:text-xs na:leading-5 na:text-[var(--na-muted)] na:md:block">仅本页内存 · 刷新重置</p>
    </aside>
    <main class="na:min-h-0 na:min-w-0 na:flex-1 na:overflow-y-auto na:bg-[var(--na-canvas)] na:p-5 na:sm:p-8 na:lg:p-12" :aria-busy="busy">
      <div class="na:mx-auto na:w-full na:max-w-6xl">
        <header class="na:mb-7 na:flex na:flex-wrap na:items-start na:justify-between na:gap-4">
          <div><h1 ref="heading" tabindex="-1" class="na:m-0 na:text-2xl na:font-semibold na:tracking-tight">{{ currentTab.label }}</h1><p :class="muted" class="na:mt-2 na:mb-0">{{ currentTab.description }}</p></div>
          <span v-if="simulated" class="na:rounded-full na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-3 na:py-1.5 na:text-xs na:text-[var(--na-muted)]">虚构账户演示</span>
        </header>
        <div v-if="error && !modal" role="alert" class="na:mb-5 na:rounded-xl na:border na:border-[var(--na-error)] na:p-4 na:text-sm na:text-[var(--na-error)]">{{ error }} <NovaButton v-if="!snapshot" variant="ghost" @click="refresh">重新加载</NovaButton></div>
        <p v-if="notice" role="status" class="na:mb-5 na:text-sm na:text-[var(--na-brand)]">{{ notice }}</p>
        <p v-if="!snapshot && busy" role="status" :class="muted">正在加载账户…</p>
        <template v-if="snapshot">
          <section v-if="page === 'overview'" class="na:space-y-6">
            <div :class="panel" class="na:flex na:flex-wrap na:items-center na:gap-5">
              <div class="na:flex na:size-16 na:items-center na:justify-center na:rounded-2xl na:bg-[var(--na-soft)] na:text-2xl na:text-[var(--na-brand)]" aria-hidden="true">{{ snapshot.profile.nickname.slice(0, 1).toUpperCase() }}</div>
              <div class="na:min-w-0 na:flex-1"><h2 class="na:m-0 na:text-xl na:font-semibold">你好，{{ snapshot.profile.nickname }}</h2><p class="na:my-2 na:break-all" :class="muted">{{ snapshot.email }}</p><p class="na:m-0 na:break-words" :class="muted">{{ snapshot.profile.bio || '还没有添加简介' }}</p></div>
              <NovaButton variant="secondary" @click="requestNavigation('profile')">编辑资料</NovaButton>
            </div>
            <div class="na:grid na:grid-cols-1 na:gap-4 na:sm:grid-cols-2 na:xl:grid-cols-4">
              <button v-for="tab in tabs.filter(item => ['profile', 'security', 'devices', 'notifications'].includes(item.id))" :key="tab.id" type="button" :class="panel" class="na:flex na:items-center na:gap-4 na:text-left na:hover:border-[var(--na-brand)]" @click="requestNavigation(tab.id)"><span class="na:text-xl na:text-[var(--na-brand)]" aria-hidden="true">{{ tab.symbol }}</span><div><strong class="na:block na:text-sm na:font-medium">{{ tab.label }}</strong><span class="na:mt-1 na:block na:text-xs na:text-[var(--na-muted)]">{{ tab.id === 'devices' ? `${snapshot.devices.length} 台${simulated ? '模拟' : ''}设备` : '查看与管理' }}</span></div><span class="na:ml-auto na:text-[var(--na-muted)]" aria-hidden="true">→</span></button>
            </div>
            <section :class="panel"><h2 class="na:mt-0 na:mb-5 na:text-base na:font-semibold">最近动态</h2><ul class="na:m-0 na:list-none na:p-0"><li v-for="entry in snapshot.activity.slice(0, 4)" :key="entry.id" class="na:flex na:flex-wrap na:gap-3 na:border-t na:border-[var(--na-line)] na:py-4"><span class="na:mt-2 na:size-1.5 na:rounded-full na:bg-[var(--na-brand)]" aria-hidden="true"></span><div class="na:min-w-0 na:flex-1"><strong class="na:text-sm na:font-medium">{{ entry.title }}</strong><p class="na:mt-1 na:mb-0" :class="muted">{{ entry.description }}</p></div><time :datetime="entry.at" class="na:text-xs na:text-[var(--na-muted)]">{{ formatTime(entry.at) }}</time></li></ul></section>
          </section>

          <form v-else-if="page === 'profile'" class="na:max-w-3xl na:space-y-5" @submit.prevent="saveProfile">
            <section :class="panel" class="na:space-y-6">
              <fieldset class="na:m-0 na:border-0 na:p-0" :disabled="busy"><legend class="na:mb-3 na:text-sm na:font-medium">预设头像</legend><div class="na:flex na:flex-wrap na:gap-3"><button v-for="avatar in avatarOptions" :key="avatar.id" type="button" :aria-label="avatar.label" :aria-pressed="profile.avatar === avatar.id" class="na:flex na:size-12 na:items-center na:justify-center na:rounded-2xl na:border-2 na:text-lg na:text-white" :class="profile.avatar === avatar.id ? 'na:border-[var(--na-ink)] na:ring-2 na:ring-[var(--na-surface)]' : 'na:border-transparent'" :style="{ backgroundColor: avatar.color }" @click="profile.avatar = avatar.id">{{ profile.avatar === avatar.id ? '✓' : 'N' }}</button></div></fieldset>
              <NovaField v-model="profile.nickname" label="昵称" autocomplete="nickname" :disabled="busy" /><p class="na:-mt-4 na:text-xs na:text-[var(--na-muted)]">{{ [...profile.nickname].length }} / 24 字符</p>
              <div><label :for="`${id}-bio`" class="na:mb-2 na:block na:text-sm na:font-medium">个人简介</label><textarea :id="`${id}-bio`" v-model="profile.bio" rows="4" :disabled="busy" class="na:w-full na:resize-y na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:p-3 na:text-base na:text-[var(--na-ink)]" /><p class="na:mt-2 na:mb-0 na:text-xs na:text-[var(--na-muted)]">{{ [...profile.bio].length }} / 120 字符</p></div>
              <p v-if="simulated" :class="muted" class="na:m-0">请只填写虚构资料。不上传头像，不发送到服务器。</p>
            </section>
            <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4"><p role="status" class="na:m-0 na:text-xs na:text-[var(--na-muted)]">{{ dirty ? '有未保存的修改' : '没有未保存的修改' }}</p><div class="na:flex na:gap-3"><NovaButton variant="secondary" @click="discardDraft">取消</NovaButton><NovaButton variant="primary" type="submit" :disabled="!dirty || busy">{{ busy ? '保存中…' : '保存资料' }}</NovaButton></div></div>
          </form>

          <section v-else-if="page === 'security'" class="na:space-y-6">
            <slot name="security" :snapshot="snapshot" :adapter="adapter" :refresh="refresh">
              <div :class="panel" class="na:space-y-6">
                <div class="na:flex na:items-center na:justify-between na:gap-4"><div><h2 class="na:m-0 na:text-sm na:font-semibold">登录密码</h2><p class="na:mt-2 na:mb-0" :class="muted">{{ snapshot.security.passwordUpdatedAt ? '密码更新时间：' + formatTime(snapshot.security.passwordUpdatedAt) : '已设置' }}{{ simulated ? ' · 示例密码' : '' }}</p></div><NovaButton v-if="simulated" variant="secondary" :disabled="busy" @click="openModal('password')">修改</NovaButton></div>
                <div class="na:flex na:items-center na:justify-between na:gap-4 na:border-t na:border-[var(--na-line)] na:pt-6"><div class="na:min-w-0"><h2 class="na:m-0 na:text-sm na:font-semibold">绑定邮箱</h2><p class="na:mt-2 na:mb-0 na:break-all" :class="muted">{{ snapshot.email }}</p></div><NovaButton v-if="simulated" variant="secondary" :disabled="busy" @click="openModal('email')">更换</NovaButton></div>
                <div class="na:flex na:items-center na:justify-between na:gap-4 na:border-t na:border-[var(--na-line)] na:pt-6"><div><h2 class="na:m-0 na:text-sm na:font-semibold">两步验证</h2><p class="na:mt-2 na:mb-0" :class="muted">{{ snapshot.security.twoStepEnabled ? '已开启' : '未开启' }}{{ simulated ? ' · 仅演示' : '' }}</p></div><NovaButton v-if="simulated" variant="secondary" :disabled="busy" @click="openModal('twoStep')">{{ snapshot.security.twoStepEnabled ? '关闭' : '开启' }}</NovaButton></div>
              </div>
              <p :class="muted">{{ simulated ? '仅模拟操作，不变更真实凭据，也不生成真实验证密钥。' : '安全操作需要接入方通过 security 插槽提供真实二次认证流程。' }}</p>
            </slot>
            <section :class="panel"><h2 class="na:mt-0 na:mb-5 na:text-base na:font-semibold">安全活动</h2><div role="group" aria-label="安全活动筛选" class="na:mb-4 na:flex na:flex-wrap na:gap-2"><NovaButton v-for="filter in filterOptions" :key="filter.value" :variant="activityFilter === filter.value ? 'primary' : 'secondary'" :aria-pressed="activityFilter === filter.value" @click="activityFilter = filter.value">{{ filter.label }}</NovaButton></div><ul class="na:m-0 na:list-none na:p-0"><li v-for="entry in visibleActivities" :key="entry.id" class="na:border-t na:border-[var(--na-line)] na:py-4"><div class="na:flex na:flex-wrap na:justify-between na:gap-2"><strong class="na:text-sm na:font-medium">{{ entry.title }}</strong><time class="na:text-xs na:text-[var(--na-muted)]" :datetime="entry.at">{{ formatTime(entry.at) }}</time></div><p class="na:mt-1 na:mb-0" :class="muted">{{ entry.description }}</p></li></ul><p v-if="!visibleActivities.length" :class="muted">暂时没有此类安全活动。</p><div class="na:mt-3 na:flex na:items-center na:justify-between"><span class="na:text-xs na:text-[var(--na-muted)]">{{ activityPage + 1 }} / {{ activityPages }}</span><div class="na:flex na:gap-2"><NovaButton variant="secondary" aria-label="上一页安全活动" :disabled="activityPage === 0" @click="activityPage--">←</NovaButton><NovaButton variant="secondary" aria-label="下一页安全活动" :disabled="activityPage >= activityPages - 1" @click="activityPage++">→</NovaButton></div></div></section>
          </section>

          <section v-else-if="page === 'devices'" class="na:space-y-5">
            <div class="na:flex na:justify-end"><NovaButton variant="secondary" :disabled="busy || !snapshot.devices.some(device => !device.current)" @click="openModal('revokeAll')">退出其他设备</NovaButton></div>
            <div :class="panel"><article v-for="device in snapshot.devices" :key="device.id" class="na:flex na:flex-wrap na:items-center na:gap-4 na:border-b na:border-[var(--na-line)] na:py-5 na:last:border-b-0"><span class="na:flex na:size-11 na:items-center na:justify-center na:rounded-xl na:bg-[var(--na-soft)] na:text-lg na:text-[var(--na-brand)]" aria-hidden="true">▣</span><div class="na:min-w-0 na:flex-1"><h2 class="na:m-0 na:text-sm na:font-semibold">{{ device.name }}</h2><p class="na:my-1" :class="muted">{{ device.platform }} · {{ device.location }}</p><p class="na:m-0 na:text-xs na:text-[var(--na-muted)]">最近活动 {{ formatTime(device.lastActiveAt) }}</p></div><span v-if="device.current" class="na:rounded-lg na:bg-[var(--na-soft)] na:px-3 na:py-2 na:text-xs na:text-[var(--na-brand)]">当前设备</span><NovaButton v-else variant="ghost" :disabled="busy" :aria-label="`退出 ${device.name}`" @click="openModal('revoke', device.id)">退出</NovaButton></article></div>
            <p v-if="simulated" :class="muted">全部为虚构记录，不检测你的设备或位置。</p>
          </section>

          <form v-else-if="page === 'notifications'" class="na:max-w-3xl na:space-y-5" @submit.prevent="saveNotifications">
            <div :class="panel"><label v-for="option in preferenceOptions" :key="option.key" class="na:flex na:cursor-pointer na:items-center na:justify-between na:gap-5 na:border-b na:border-[var(--na-line)] na:py-6 na:last:border-b-0"><span><strong class="na:block na:text-sm na:font-semibold">{{ option.label }}</strong><span class="na:mt-1 na:block" :class="muted">{{ option.description }}</span></span><input v-model="notifications[option.key]" type="checkbox" role="switch" :aria-label="option.label" :disabled="busy" class="na:h-6 na:w-11 na:shrink-0 na:cursor-pointer na:accent-[var(--na-brand)]" /></label></div>
            <p v-if="simulated" :class="muted">偏好只保存在本页，不会发送真实通知。</p>
            <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4"><p role="status" class="na:m-0 na:text-xs na:text-[var(--na-muted)]">{{ dirty ? '有未保存的修改' : '没有未保存的修改' }}</p><div class="na:flex na:gap-3"><NovaButton variant="secondary" @click="discardDraft">取消</NovaButton><NovaButton variant="primary" type="submit" :disabled="!dirty || busy">{{ busy ? '保存中…' : '保存偏好' }}</NovaButton></div></div>
          </form>

          <section v-else-if="page === 'messages'" class="na:space-y-5">
            <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-4"><div role="group" aria-label="消息筛选" class="na:flex na:gap-2"><NovaButton :variant="messageFilter === 'all' ? 'primary' : 'secondary'" :aria-pressed="messageFilter === 'all'" @click="messageFilter = 'all'">全部消息</NovaButton><NovaButton :variant="messageFilter === 'unread' ? 'primary' : 'secondary'" :aria-pressed="messageFilter === 'unread'" @click="messageFilter = 'unread'">未读 {{ unread }}</NovaButton></div><NovaButton variant="secondary" :disabled="busy || !unread" @click="mutate(context => adapter.markAllMessagesRead(context), '全部消息已标为已读。')">全部标为已读</NovaButton></div>
            <div :class="panel"><article v-for="message in visibleMessages" :key="message.id" class="na:flex na:flex-wrap na:items-start na:gap-3 na:border-b na:border-[var(--na-line)] na:py-5 na:last:border-b-0"><span class="na:mt-3 na:size-1.5 na:shrink-0 na:rounded-full" :class="message.read ? 'na:bg-transparent' : 'na:bg-[var(--na-brand)]'" aria-hidden="true"></span><button type="button" :disabled="busy" class="na:min-w-36 na:flex-1 na:border-0 na:bg-transparent na:p-0 na:text-left" :aria-label="`${message.read ? '已读' : '未读'}：${message.title}，查看详情`" @click="openMessage(message.id)"><span class="na:text-xs na:text-[var(--na-brand)]">{{ { security: '安全', product: '产品', account: '账户' }[message.category] }}</span><h2 class="na:mt-2 na:mb-1 na:text-sm na:font-semibold">{{ message.title }}</h2><p class="na:my-1" :class="muted">{{ message.summary }}</p><time :datetime="message.createdAt" class="na:mt-2 na:block na:text-xs na:text-[var(--na-muted)]">{{ formatTime(message.createdAt) }}</time></button><NovaButton v-if="!message.read" variant="ghost" :disabled="busy" @click="markRead(message.id)">标为已读</NovaButton></article><div v-if="!visibleMessages.length" class="na:py-12 na:text-center"><span class="na:text-2xl na:text-[var(--na-brand)]" aria-hidden="true">✓</span><h2 class="na:mt-4 na:text-base na:font-semibold">都读完了</h2><p :class="muted">这里暂时没有未读消息。</p></div></div>
          </section>
          <section v-else-if="page === 'appearance'" :class="panel"><slot name="appearance"><p :class="muted">通过 appearance 插槽接入 NovaAppearance 或站点外观设置。</p></slot></section>
        </template>
      </div>
    </main>

    <NovaDialog :open="queued !== null" title="还有未保存的修改" @close="queued = null"><p :class="muted">离开将放弃当前页尚未保存的修改。</p><div class="na:mt-6 na:flex na:flex-wrap na:justify-end na:gap-3"><NovaButton variant="secondary" @click="queued = null">继续编辑</NovaButton><NovaButton variant="primary" @click="discardAndNavigate">放弃并离开</NovaButton></div></NovaDialog>
    <NovaDialog :open="modal !== null" :title="modalTitle" @close="closeModal">
      <template v-if="modal === 'message' && selectedMessage"><p class="na:mt-0 na:text-xs na:text-[var(--na-muted)]">{{ formatTime(selectedMessage.createdAt) }}</p><p class="na:whitespace-pre-wrap na:break-words na:text-sm na:leading-7">{{ selectedMessage.body }}</p><p v-if="error" role="alert" class="na:text-sm na:text-[var(--na-error)]">{{ error }}</p></template>
      <form v-else class="na:space-y-4" @submit.prevent="submitSecurity">
        <p v-if="simulated" :class="muted" class="na:mt-0">仅操作虚构演示资料，不影响真实账户。请勿输入真实凭据。</p>
        <template v-if="modal === 'password' || modal === 'email' || modal === 'twoStep'">
          <NovaField v-model="securityValues.currentPassword" label="当前密码" type="password" autocomplete="off" :disabled="busy" />
          <template v-if="modal === 'password'"><NovaField v-model="securityValues.newPassword" label="新密码" type="password" autocomplete="off" :disabled="busy" /><NovaField v-model="securityValues.confirmPassword" label="确认新密码" type="password" autocomplete="off" :disabled="busy" /></template>
          <template v-if="modal === 'email'"><NovaField v-model="securityValues.email" label="新邮箱" type="email" autocomplete="off" :disabled="busy" /><div class="na:flex na:items-end na:gap-3"><div class="na:min-w-0 na:flex-1"><NovaField v-model="securityValues.code" label="邮箱验证码" autocomplete="off" :disabled="busy || !codeSent" /></div><NovaButton variant="secondary" :disabled="busy || !securityValues.email || !securityValues.currentPassword" @click="sendEmailCode">{{ busy ? '处理中…' : '获取演示码' }}</NovaButton></div><p v-if="codeSent" role="status" :class="muted">{{ demoCode ? `演示验证码：${demoCode}（未发送邮件）` : '验证码已发送，请查收。' }}</p></template>
          <template v-if="modal === 'twoStep'"><p :class="muted">仅使用模拟确认码，不生成密钥或绑定真实验证器。</p><NovaField v-model="securityValues.code" label="模拟确认码" autocomplete="off" :disabled="busy" /></template>
          <slot name="securityFormTools" :fill="fillSecurity" />
        </template>
        <p v-else :class="muted">{{ modal === 'revokeAll' ? '当前设备会保留；确认退出所有其他设备？' : '确认退出此设备的会话？' }}</p>
        <p v-if="error" role="alert" class="na:text-sm na:text-[var(--na-error)]">{{ error }}</p>
        <div class="na:flex na:justify-end na:gap-3 na:pt-2"><NovaButton variant="secondary" @click="closeModal">取消</NovaButton><NovaButton variant="primary" type="submit" :disabled="busy || (modal === 'email' && !codeSent)">{{ busy ? '处理中…' : simulated ? '确认演示操作' : '确认' }}</NovaButton></div>
      </form>
    </NovaDialog>
  </div>
</template>
