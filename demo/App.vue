<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import {
  NovaAccount,
  NovaAppearance,
  NovaAuthForm,
  NovaButton,
  NovaCaptcha,
  NovaDialog,
  NovaError,
  NovaField,
  NovaTheme,
} from '../src'
import type {
  AccountAdapter,
  AccountPage,
  AccountSnapshot,
  Appearance,
  AuthAdapter,
  NovaAdapter,
  NovaLocale,
  PasswordStrength,
} from '../src'
import {
  createDemoAuthAdapter,
  defaultSettings,
  demoCode,
  demoUser,
  DEMO_EMAIL,
  DEMO_PASSWORD,
} from './auth'
import { createDemoAccountAdapter, DEMO_ACCOUNT_VALUES } from './account'
import './demo.css'
const settings = reactive(defaultSettings())
const signedIn = ref(false)
const locale = ref<NovaLocale>('zh-CN')
const timeZone = ref('Asia/Shanghai')
const toolsOpen = ref(false)
const panel = ref<'tools' | 'appearance' | 'settings' | 'host' | 'about'>('tools')
const layout = ref<'full' | 'embedded'>('full')
const strengthOn = ref(false)
const customSecurity = ref(false)
const page = ref<AccountPage>('overview')
const pageLog = ref<string[]>([])
const pageLabels: Record<AccountPage, string> = {
  overview: '账户概览',
  profile: '个人资料',
  security: '安全设置',
  devices: '登录设备',
  notifications: '通知偏好',
  messages: '消息中心',
  appearance: '外观',
}
const pages = Object.entries(pageLabels) as [AccountPage, string][]
const totp = reactive({ password: '', code: '', busy: false, error: '' })
const mathAnswer = ref('')
const storageFault = ref(false)
const storageNote = ref('')
const sessionArmed = ref(false)
const sessionNote = ref('')
const flowNote = ref('')
const oauthOn = ref(false)
const deleteOpen = ref(false)
const account = ref<InstanceType<typeof NovaAccount>>()
const conflictArmed = computed(() => settings.conflict === 'dirty')
const multiInstance = ref(false)
const viewportWidth = ref<'off' | '390' | '320'>('off')
const instances = reactive<
  {
    key: string
    title: string
    appearance: Appearance
    adapter: AuthAdapter
    signedIn: boolean
  }[]
>([
  {
    key: 'a',
    title: '实例 A · 深色 / 暖琥珀',
    appearance: { mode: 'dark', accent: 'amber' },
    adapter: createDemoAuthAdapter(),
    signedIn: false,
  },
  {
    key: 'b',
    title: '实例 B · 浅色 / 湖水绿',
    appearance: { mode: 'light', accent: 'teal' },
    adapter: createDemoAuthAdapter(),
    signedIn: false,
  },
])
function createAdapter(): NovaAdapter {
  return {
    simulated: true,
    auth: createDemoAuthAdapter({ settings: () => settings }),
    account: createDemoAccountAdapter({
      settings: () => settings,
      wait: async (signal) => {
        const config = { ...settings }
        await new Promise((resolve) => setTimeout(resolve, config.network === 'slow' ? 3000 : 350))
        if (signal.aborted) throw new NovaError('CANCELLED', '操作已取消。')
        if (config.network === 'offline')
          throw new NovaError('NETWORK', '模拟网络不可用，请在体验工具恢复正常后重试。')
        if (config.auth === 'fail') throw new NovaError('REJECTED', '模拟请求被拒绝，状态未改变。')
        if (sessionArmed.value) {
          sessionArmed.value = false
          scheduleSessionExpiredReturn()
          throw new NovaError('SESSION_EXPIRED', '登录状态已过期（模拟 401），请重新登录。')
        }
      },
    }),
  }
}
const adapter = shallowRef(createAdapter())
function fill() {
  toolsOpen.value = false
  account.value?.fill({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    confirmPassword: DEMO_PASSWORD,
    code: demoCode(settings.codeLength),
  })
}
function preview() {
  toolsOpen.value = false
  account.value?.preview(demoUser())
  signedIn.value = true
}
function resetDemo() {
  signedIn.value = false
  page.value = 'overview'
  pageLog.value = []
  totp.password = ''
  totp.code = ''
  totp.error = ''
  sessionArmed.value = false
  deleteOpen.value = false
  clearTimeout(sessionTimer)
  sessionNote.value = ''
  adapter.value = createAdapter()
}
let sessionTimer: ReturnType<typeof setTimeout> | undefined
let flowTimer: ReturnType<typeof setTimeout> | undefined
/** Real hosts react to 401 by clearing the local session; the demo mirrors that pattern. */
function scheduleSessionExpiredReturn() {
  clearTimeout(sessionTimer)
  sessionTimer = setTimeout(() => {
    if (signedIn.value)
      forceReturnToAuth('登录状态已过期（模拟 401），已清除本地会话并返回登录页。')
  }, 1400)
}
function forceReturnToAuth(note: string) {
  resetDemo()
  sessionNote.value = note
  sessionTimer = setTimeout(() => {
    sessionNote.value = ''
  }, 10_000)
}
function flashFlowNote(text: string) {
  flowNote.value = text
  clearTimeout(flowTimer)
  flowTimer = setTimeout(() => {
    flowNote.value = ''
  }, 10_000)
}
function toggleSessionArmed() {
  sessionArmed.value = !sessionArmed.value
}
function armConflict() {
  settings.conflict = 'dirty'
  flashFlowNote(
    '已模拟另一台设备修改资料：下一次账户操作将返回 REVISION_CONFLICT。真实接入通常在此时重新加载快照；演示中刷新页面或重新登录即恢复。',
  )
}
function confirmDelete() {
  forceReturnToAuth('演示账户注销完成：这是内存模拟，刷新页面后账户会复原。')
}
function openTools() {
  panel.value = 'tools'
  toolsOpen.value = true
}
/** The preview window has a real narrow viewport, so media queries respond to it. */
function openViewportPreview() {
  if (viewportWidth.value === 'off') return
  window.open(location.href, 'nova-viewport-preview', `width=${viewportWidth.value},height=844`)
}
function onPageChange(value: AccountPage) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  pageLog.value = [`${time} ${pageLabels[value]}`, ...pageLog.value].slice(0, 4)
}
/** Strength evaluation lives in the host; presentation only, never a submission gate. */
function demoStrength(password: string): PasswordStrength {
  const length = [...password].length
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length
  const score = Math.min(
    4,
    (length >= 12 ? 2 : length >= 8 ? 1 : 0) + (kinds >= 3 ? 2 : kinds >= 2 ? 1 : 0),
  )
  const labels = ['过短', '较弱', '一般', '良好', '很强']
  const hints = [
    '至少使用 8 个字符。',
    '加长到 12 位以上，并混合大小写、数字与符号。',
    '再混合更多字符类型会更安全。',
    '不错的长度与字符组合。',
    '长度与字符类型都很充分。',
  ]
  return { score: score as PasswordStrength['score'], label: labels[score]!, hint: hints[score] }
}
function submitMath(captcha: { busy: boolean; submit: (response: unknown) => Promise<void> }) {
  if (captcha.busy) return
  const answer = mathAnswer.value.trim()
  mathAnswer.value = ''
  void captcha.submit({ answer })
}
async function submitTotp(
  accountAdapter: AccountAdapter,
  snapshot: AccountSnapshot,
  refresh: () => Promise<AccountSnapshot | undefined>,
) {
  if (totp.busy) return
  totp.busy = true
  totp.error = ''
  try {
    await accountAdapter.setTwoStep(
      {
        enabled: !snapshot.security.twoStepEnabled,
        currentPassword: totp.password,
        code: totp.code,
      },
      {
        signal: new AbortController().signal,
        requestId: `demo-totp-${Date.now()}`,
        revision: snapshot.revision,
      },
    )
    await refresh()
    totp.password = ''
    totp.code = ''
  } catch (cause) {
    totp.error = cause instanceof Error ? cause.message : '操作失败，请重试。'
  } finally {
    totp.busy = false
  }
}
let savedStorage: PropertyDescriptor | undefined
function onStorageChange(
  theme: { appearance: Appearance; setAppearance: (value: Appearance, persist?: boolean) => void },
  event: Event,
) {
  const broken = (event.target as HTMLInputElement).checked
  storageFault.value = broken
  storageNote.value = ''
  if (broken) {
    if (!savedStorage) savedStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('演示：本地存储已禁用。', 'SecurityError')
      },
    })
    // Trigger one write so the resulting storageError shows up immediately.
    theme.setAppearance(theme.appearance)
    storageNote.value = '已拦截 localStorage，并尝试写入一次外观偏好。'
  } else if (savedStorage) {
    Object.defineProperty(window, 'localStorage', savedStorage)
    savedStorage = undefined
    storageNote.value = '已恢复本地存储；下次成功保存外观时错误提示会消失。'
  }
}
</script>
<template>
  <div :class="layout === 'embedded' ? 'demo-embedded' : undefined">
    <p v-if="sessionNote" role="status" class="demo-banner">{{ sessionNote }}</p>
    <p v-if="flowNote" role="status" class="demo-banner">{{ flowNote }}</p>
    <div v-if="multiInstance" class="demo-multi-bar">
      <p class="demo-note">
        两个独立的 NovaTheme
        根：明暗、品牌色与登录状态互不影响，也不写入浏览器存储。主界面已暂时替换。
      </p>
      <!-- 该栏位于组件主题根之外，使用页面级固定配色 -->
      <button type="button" class="demo-back" @click="multiInstance = false">返回单实例演示</button>
    </div>
    <div v-if="multiInstance" class="demo-multi">
      <section v-for="instance in instances" :key="instance.key" class="demo-multi-cell">
        <h2 class="demo-multi-title">{{ instance.title }}</h2>
        <NovaTheme v-slot="theme" :model-value="instance.appearance">
          <div class="demo-multi-card">
            <p class="demo-note">
              mode：{{ theme.appearance.mode }} · accent：{{ theme.appearance.accent }}
            </p>
            <NovaAuthForm
              v-if="!instance.signedIn"
              :adapter="instance.adapter"
              simulated
              @authenticated="instance.signedIn = true"
            />
            <div v-else class="demo-stack">
              <p class="na:m-0 na:text-sm">此实例已登录，状态独立于另一实例。</p>
              <NovaButton @click="instance.signedIn = false">退出此实例</NovaButton>
            </div>
          </div>
        </NovaTheme>
      </section>
    </div>
    <template v-else>
      <div v-if="layout === 'embedded'" class="demo-hostbar">
        <strong>虚构宿主站点</strong>
        <span>首页 · 商店 · 社区 · 账户设置</span>
      </div>
      <NovaAccount
        ref="account"
        class="nova-demo"
        :class="signedIn ? 'demo-account' : 'demo-auth'"
        :adapter="adapter"
        :locale="locale"
        :time-zone="timeZone"
        :layout="layout"
        :page="page"
        storage-key="nova-appearance-v1"
        :code-length="settings.codeLength"
        :password-strength="strengthOn ? demoStrength : undefined"
        @authenticated="signedIn = true"
        @update:page="page = $event"
        @page-change="onPageChange"
        @logout="resetDemo"
      >
        <template #tools="theme">
          <NovaButton variant="ghost" @click="openTools"
            >体验工具 <span aria-hidden="true">↗</span></NovaButton
          >
          <NovaDialog
            :open="toolsOpen"
            :title="
              panel === 'appearance'
                ? '外观设置'
                : panel === 'settings'
                  ? '演示设置'
                  : panel === 'host'
                    ? '宿主集成演示'
                    : panel === 'about'
                      ? '关于这份组件库'
                      : '体验工具'
            "
            @close="toolsOpen = false"
          >
            <div v-if="panel === 'tools'" class="demo-stack">
              <NovaButton variant="primary" @click="fill">一键填入示例</NovaButton>
              <NovaButton @click="preview">用户中心预览</NovaButton>
              <NovaButton @click="panel = 'appearance'">外观设置</NovaButton>
              <NovaButton @click="panel = 'settings'">演示设置</NovaButton>
              <NovaButton @click="panel = 'host'">宿主集成演示</NovaButton>
              <NovaButton @click="panel = 'about'">组件库与隐私说明</NovaButton>
              <p class="demo-note">全部账户、设备与消息均为虚构。快捷预览不代表身份认证。</p>
            </div>
            <NovaAppearance
              v-else-if="panel === 'appearance'"
              :model-value="theme.appearance"
              :storage-error="theme.storageError"
              @update:model-value="theme.setAppearance"
            />
            <div v-else-if="panel === 'settings'" class="demo-stack">
              <label
                >界面语言<select v-model="locale">
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select></label
              >
              <label
                >显示时区<select v-model="timeZone">
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="UTC">UTC</option>
                </select></label
              >
              <label
                >网络响应<select v-model="settings.network">
                  <option value="normal">正常</option>
                  <option value="slow">慢速 · 3 秒</option>
                  <option value="offline">断网</option>
                </select></label
              >
              <label
                >挑战方式<select v-model="settings.challenge">
                  <option value="slider">滑块（内置 NovaCaptcha）</option>
                  <option value="math">算术题（宿主 #captcha 插槽）</option>
                </select></label
              >
              <label
                >滑块结果<select v-model="settings.captcha">
                  <option value="normal">正常</option>
                  <option value="fail">验证失败</option>
                  <option value="expired">已过期</option>
                </select></label
              >
              <label
                >邮箱验证码<select v-model="settings.code">
                  <option value="normal">正常有效</option>
                  <option value="expired">已过期</option>
                </select></label
              >
              <label
                >业务请求<select v-model="settings.auth">
                  <option value="normal">正常</option>
                  <option value="fail">拒绝请求</option>
                </select></label
              >
              <label
                >发送限流<select v-model="settings.rate">
                  <option value="normal">正常</option>
                  <option value="limited">首次成功后限流 20 秒</option>
                </select></label
              >
              <p class="demo-note">
                设置仅作用于本页模拟。真实服务端状态不受影响。“滑块结果”的失败与过期同样作用于算术题挑战；限流在首次发送成功后生效，期间再发会返回带剩余秒数的提示。
              </p>
              <NovaButton @click="Object.assign(settings, defaultSettings())">恢复正常</NovaButton>
            </div>
            <div v-else-if="panel === 'host'" class="demo-stack">
              <label
                >外壳布局 layout<select v-model="layout">
                  <option value="full">全屏（默认）</option>
                  <option value="embedded">嵌入宿主页面</option>
                </select></label
              >
              <p class="demo-note">
                嵌入模式保留 header/footer、高度随内容；组件主题独立于宿主页面配色。
              </p>
              <div role="group" aria-label="受控页面导航" class="demo-stack">
                <p class="demo-note">
                  受控导航 v-model:page。当前页面：{{ pageLabels[page] }}。宿主赋值 page
                  属权威跳转，不经过组件内未保存守卫；组件内页签会先弹出确认。
                </p>
                <div class="demo-grid">
                  <button
                    v-for="[key, label] in pages"
                    :key="key"
                    type="button"
                    class="demo-chip"
                    :class="{ 'demo-chip-on': page === key }"
                    :disabled="!signedIn"
                    @click="page = key"
                  >
                    {{ label }}
                  </button>
                </div>
                <p v-if="pageLog.length" class="demo-note">pageChange：{{ pageLog.join(' · ') }}</p>
                <p v-else-if="signedIn" class="demo-note">切换页签或点击上方按钮，观察事件记录。</p>
                <p v-else class="demo-note">登录或使用“用户中心预览”后可用。</p>
              </div>
              <label
                >验证码长度 codeLength<select v-model="settings.codeLength">
                  <option :value="6">6 位（默认）</option>
                  <option :value="4">4 位</option>
                  <option :value="null">不限制 maxlength</option>
                </select></label
              >
              <p class="demo-note">
                仅调整登录表单展示；演示码同步为对应长度（4 位时为
                2468）。账户中心安全表单不受影响。
              </p>
              <label
                ><input v-model="strengthOn" type="checkbox" /> 注入 passwordStrength
                宿主强度评估</label
              >
              <p class="demo-note">
                注册与重置“设置新密码”一步显示评分、标签与提示；只影响展示，不拦截提交。
              </p>
              <label
                ><input v-model="customSecurity" type="checkbox" /> 安全页改用 #security 插槽（TOTP
                形式演示）</label
              >
              <p class="demo-note">
                开启后内置安全页被插槽替换：验证码 {{ DEMO_ACCOUNT_VALUES.code }}，当前密码
                {{ DEMO_ACCOUNT_VALUES.currentPassword }}。
              </p>
              <label
                ><input
                  type="checkbox"
                  :checked="storageFault"
                  @change="onStorageChange(theme, $event)"
                />
                禁用本地存储（演示 storageError）</label
              >
              <p v-if="storageNote" role="status" class="demo-note">{{ storageNote }}</p>
              <p v-if="theme.storageError" role="alert" class="demo-note">
                {{ theme.storageError }}
              </p>
              <div role="group" aria-label="流程场景" class="demo-stack">
                <p class="demo-note">真实接入方需要处理的会话与并发场景（登录后可用）。</p>
                <div class="demo-grid">
                  <button
                    type="button"
                    class="demo-chip"
                    :class="{ 'demo-chip-on': sessionArmed }"
                    :disabled="!signedIn"
                    @click="toggleSessionArmed"
                  >
                    {{ sessionArmed ? '取消过期标记' : '让会话过期' }}
                  </button>
                  <button
                    type="button"
                    class="demo-chip"
                    :class="{ 'demo-chip-on': conflictArmed }"
                    :disabled="!signedIn"
                    @click="armConflict"
                  >
                    模拟另一设备修改
                  </button>
                </div>
                <p class="demo-note">
                  会话过期：下一次账户请求返回 401，随后自动清除本地会话并返回登录页。
                  外部修改：下一次账户操作返回 REVISION_CONFLICT；演示中刷新页面或重新登录即恢复。
                </p>
              </div>
              <label
                ><input v-model="oauthOn" type="checkbox" /> 登录卡片显示第三方登录占位（#authFooter
                插槽）</label
              >
              <p class="demo-note">占位按钮仅展示、不发起任何请求；真实跳转与回调由宿主实现。</p>
              <label
                ><input v-model="multiInstance" type="checkbox" />
                多实例主题隔离演示（替换主界面）</label
              >
              <p class="demo-note">
                两个独立 NovaTheme 根各自渲染 NovaAuthForm；组件内导航、外观与登录状态完全隔离。
              </p>
              <div role="group" aria-label="视口预览" class="demo-stack">
                <label
                  >手机视口预览<select v-model="viewportWidth">
                    <option value="off">关闭</option>
                    <option value="390">iPhone · 390 × 844</option>
                    <option value="320">小屏 · 320 × 568</option>
                  </select></label
                >
                <p class="demo-note">
                  在真实窄视口窗口中打开本页，媒体查询（如移动导航）按该宽度响应；不模拟、不缩放。
                </p>
                <NovaButton :disabled="viewportWidth === 'off'" @click="openViewportPreview"
                  >打开预览窗口</NovaButton
                >
              </div>
            </div>
            <div v-else class="demo-stack">
              <p>
                原生 Vue 3 + TypeScript 组件库开发预览，布局与状态由 Vue
                响应式组件实现，样式使用命名前缀隔离的 Tailwind 工具类。
              </p>
              <p>
                所有业务能力通过接口适配器显式注入。此页面单独加载内存模拟适配器，不发邮件、不创建真实账户、不提供实际安全保护。
              </p>
              <p>
                仅明暗模式与品牌色可保存在此浏览器；密码、验证码、资料、设备、消息与安全状态都不持久化。刷新或退出即重置。
              </p>
              <p>
                真实账户接口、两站接入、npm
                发布均未实施。滑块百分比不是安全证明，服务端须执行挑战校验、限流、会话与权限控制。
              </p>
            </div>
            <template v-if="panel !== 'tools'" #footer
              ><NovaButton variant="ghost" @click="panel = 'tools'"
                >← 返回工具</NovaButton
              ></template
            >
          </NovaDialog>
        </template>
        <template #captcha="captcha">
          <form
            v-if="captcha.challenge.kind === 'custom'"
            class="demo-stack"
            :aria-busy="captcha.busy"
            @submit.prevent="submitMath(captcha)"
          >
            <p class="na:m-0 na:text-sm na:text-[var(--na-muted)]">{{ captcha.challenge.label }}</p>
            <NovaField
              v-model="mathAnswer"
              label="计算结果"
              inputmode="numeric"
              autocomplete="off"
              placeholder="例如 56"
              :disabled="captcha.busy"
              :error="captcha.error"
            />
            <div class="demo-grid">
              <NovaButton type="submit" variant="primary" :disabled="captcha.busy"
                >提交答案</NovaButton
              >
              <NovaButton :disabled="captcha.busy" @click="captcha.retry">换一题</NovaButton>
              <NovaButton variant="ghost" :disabled="captcha.busy" @click="captcha.cancel"
                >取消</NovaButton
              >
            </div>
          </form>
          <NovaCaptcha
            v-else
            :challenge="captcha.challenge"
            :busy="captcha.busy"
            :error="captcha.error"
            simulated
            @submit="captcha.submit"
            @retry="captcha.retry"
          />
        </template>
        <template v-if="oauthOn" #authFooter>
          <div role="group" aria-label="第三方登录占位" class="demo-stack">
            <div class="demo-grid demo-oauth">
              <NovaButton type="button" disabled>GitHub</NovaButton>
              <NovaButton type="button" disabled>Google</NovaButton>
              <NovaButton type="button" disabled>微软账户</NovaButton>
            </div>
            <p class="demo-note">仅演示占位（宿主 #authFooter 插槽），未接入任何第三方服务。</p>
          </div>
        </template>
        <template v-if="customSecurity" #security="{ snapshot, adapter: accountAdapter, refresh }">
          <div class="demo-stack">
            <h2 class="na:m-0 na:text-base na:font-semibold">宿主二次认证（TOTP 形式演示）</h2>
            <p class="demo-note">
              本区块由 #security
              插槽渲染，替换内置安全页。真实接入请在此实现验证器绑定、恢复码等服务端流程。
            </p>
            <p class="na:m-0 na:text-sm">
              当前状态：<strong>{{
                snapshot.security.twoStepEnabled ? '已开启两步验证' : '未开启两步验证'
              }}</strong>
            </p>
            <form
              class="demo-stack"
              :aria-busy="totp.busy"
              @submit.prevent="submitTotp(accountAdapter, snapshot, refresh)"
            >
              <NovaField
                v-model="totp.password"
                label="当前密码"
                type="password"
                autocomplete="current-password"
                :disabled="totp.busy"
              />
              <NovaField
                v-model="totp.code"
                label="验证器验证码"
                inputmode="numeric"
                autocomplete="one-time-code"
                :maxlength="6"
                :disabled="totp.busy"
                :error="totp.error"
              />
              <NovaButton type="submit" variant="primary" :disabled="totp.busy">{{
                totp.busy
                  ? '处理中…'
                  : snapshot.security.twoStepEnabled
                    ? '关闭两步验证'
                    : '开启两步验证'
              }}</NovaButton>
            </form>
            <p class="demo-note">
              演示验证器固定显示 {{ DEMO_ACCOUNT_VALUES.code }}；真实验证器每 30
              秒轮换，且服务端必须自行校验。
            </p>
            <div role="group" aria-label="危险区" class="demo-stack demo-danger">
              <p class="demo-note">
                <strong>危险区（演示）</strong>：注销当前演示账户，展示宿主实现的二次确认流程。
              </p>
              <NovaButton @click="deleteOpen = true">注销演示账户…</NovaButton>
            </div>
          </div>
          <NovaDialog :open="deleteOpen" title="注销演示账户？" @close="deleteOpen = false">
            <p>
              这是内存模拟注销：确认后会清除本页演示状态并返回登录页，刷新后账户复原。真实接入需要在服务端执行账户注销、冷静期与数据删除流程。
            </p>
            <template #footer>
              <div class="demo-grid">
                <NovaButton @click="deleteOpen = false">取消</NovaButton>
                <NovaButton variant="primary" @click="confirmDelete">确认注销</NovaButton>
              </div>
            </template>
          </NovaDialog>
        </template>
        <template #securityFormTools="{ fill: fillSecurity }"
          ><NovaButton variant="ghost" @click="fillSecurity(DEMO_ACCOUNT_VALUES)"
            >填入示例</NovaButton
          ></template
        >
        <template #footer><span v-if="signedIn">交互演示 · 请勿输入真实资料</span></template>
      </NovaAccount>
      <p v-if="layout === 'embedded'" class="demo-hostbody">
        以上是 layout="embedded" 的 NovaAccount：保留 header 与
        footer，高度由内容决定。宿主页面的其余内容会继续向下排布。
      </p>
    </template>
  </div>
</template>
