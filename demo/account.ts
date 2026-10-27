import { NovaError } from '../src/types'
import type { AccountAdapter, AccountSnapshot, Activity, MutationContext, RequestContext } from '../src/types'

export const DEMO_ACCOUNT_VALUES = {
  currentPassword: 'NovaDemo2026!', newPassword: 'NovaNext2026!', confirmPassword: 'NovaNext2026!',
  email: 'novanext@nova.example', code: '246810',
} as const

interface DemoAccountOptions {
  wait?: (signal: AbortSignal) => Promise<void>
  now?: () => number
}
const clone = <T>(value: T): T => structuredClone(value)
function fail(code: string, message: string): never { throw new NovaError(code, message) }
const assertActive = (context: RequestContext) => {
  if (context.signal.aborted) fail('CANCELLED', '操作已取消。')
}

export function createInitialAccount(time: number): AccountSnapshot {
  const at = (offset = 0) => new Date(time + offset).toISOString()
  return {
    revision: '0', profile: { id: 'nova-demo', nickname: 'Nova', bio: '把灵感，慢慢变成日常。', avatar: 'iris' },
    email: 'demo@nova.example', notifications: { product: true, email: false, security: true },
    security: { twoStepEnabled: false },
    devices: [
      { id: 'current', name: 'Mac · Chrome', platform: 'macOS', location: '上海 · 示例', lastActiveAt: at(), current: true },
      { id: 'phone', name: 'iPhone · Safari', platform: 'iOS', location: '杭州 · 示例', lastActiveAt: at(-86_400_000), current: false },
      { id: 'desktop', name: 'Windows · Edge', platform: 'Windows', location: '北京 · 示例', lastActiveAt: at(-259_200_000), current: false },
    ],
    messages: [
      { id: 'new-device', title: '新设备登录提醒', summary: '一条模拟设备提醒，帮助体验消息详情。', body: '这是一条虚构的安全消息。演示账户在一台示例 Mac 上开启了会话。\n\n本页没有检测你的设备、位置或真实登录记录。', category: 'security', createdAt: at(-900_000), read: false },
      { id: 'welcome-space', title: '欢迎体验新的账户空间', summary: '资料、安全与偏好，集中在一个地方。', body: '现在可以在账户空间中编辑虚构资料、调整通知偏好，并体验安全设置。\n\n所有变化只存在于当前页面内存。', category: 'product', createdAt: at(-7_200_000), read: false },
      { id: 'hello', title: '你好，Nova 探索者', summary: '你的演示账户已经准备好了。', body: '你可以从选择头像、填写一个虚构昵称开始。\n\n请不要填写真实资料；这里没有创建真实账户。', category: 'account', createdAt: at(-86_400_000), read: false },
      { id: 'security', title: '了解你的安全设置', summary: '密码、邮箱与两步验证均可模拟体验。', body: '两步验证使用公开固定演示码，没有绑定验证器、二维码、密钥或真实第二因素。它不会保护任何真实账户。', category: 'security', createdAt: at(-172_800_000), read: true },
      { id: 'notifications', title: '让通知更合你的习惯', summary: '选择想看到的产品、邮件与安全提醒。', body: '通知开关只影响本页演示状态，不关联真实订阅，不会发送邮件或推送。', category: 'product', createdAt: at(-259_200_000), read: false },
      { id: 'about', title: '关于这份体验资料', summary: '所有内容均为固定的虚构示例。', body: '消息、地点、资料与动态均为本地虚构示例，不代表实际发生的事件。已读状态仅保留在当前页面。', category: 'account', createdAt: at(-345_600_000), read: true },
    ],
    activity: [
      { id: 'ready', category: 'account', title: '账户体验已准备好', description: '资料和设备均为本地模拟数据。', at: at() },
      { id: 'login', category: 'devices', title: '示例登录记录', description: '虚构事件：示例设备开启了模拟会话。', at: at(-900_000) },
      { id: 'device', category: 'devices', title: '示例设备记录已添加', description: '未检测或授权任何真实设备。', at: at(-86_400_000) },
      { id: 'password', category: 'credentials', title: '示例密码已设置', description: '不代表任何真实凭据。', at: at(-172_800_000) },
    ],
  }
}

/** Synthetic data only. Not included in the library build. No network or persistence. */
export function createDemoAccountAdapter({ wait = () => new Promise(resolve => setTimeout(resolve, 350)), now = Date.now }: DemoAccountOptions = {}): AccountAdapter {
  let state = createInitialAccount(now())
  let issueCounter = 0
  let emailIssue: { id: number; email: string; expiresAt: number; resendAt: number } | undefined
  const snapshot = () => clone(state)
  const checkRevision = (context: MutationContext) => {
    assertActive(context)
    if (context.revision !== state.revision) fail('REVISION_CONFLICT', '资料已发生变化，请重新加载后再试。')
  }
  const pause = async (context: RequestContext) => { assertActive(context); await wait(context.signal); assertActive(context) }
  function commit(context: MutationContext, update: (next: AccountSnapshot) => void, category: Activity['category'], title: string) {
    checkRevision(context)
    const next = snapshot()
    update(next)
    next.revision = String(Number(state.revision) + 1)
    next.activity.unshift({ id: `activity-${next.revision}`, category, title, description: '仅更新本页模拟状态，不影响真实账户。', at: new Date(now()).toISOString() })
    next.activity = next.activity.slice(0, 24)
    state = next
    return snapshot()
  }
  function checkPassword(password: string) {
    if (password !== DEMO_ACCOUNT_VALUES.currentPassword) fail('DEMO_PASSWORD_ONLY', '请使用固定示例密码，勿输入真实密码。')
  }
  return {
    async load(context) { await pause(context); return snapshot() },
    async updateProfile(profile, context) {
      const nickname = profile.nickname.trim(), bio = profile.bio.trim()
      if (!nickname || [...nickname].length > 24 || /[\u0000-\u001f\u007f]/.test(nickname)) fail('PROFILE_NICKNAME', '昵称需为 1–24 个字符，且不能包含控制字符。')
      if ([...bio].length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(bio)) fail('PROFILE_BIO', '简介最多 120 个字符，且不能包含控制字符。')
      if (!['iris', 'teal', 'sun', 'graphite'].includes(profile.avatar)) fail('PROFILE_AVATAR', '请选择一个预设头像。')
      await pause(context)
      return commit(context, next => { next.profile = { id: state.profile.id, nickname, bio, avatar: profile.avatar } }, 'account', '个人资料已更新')
    },
    async updateNotifications(preferences, context) {
      if ([preferences.product, preferences.email, preferences.security].some(value => typeof value !== 'boolean')) fail('PREFERENCES_INVALID', '通知选项必须为开启或关闭。')
      await pause(context)
      return commit(context, next => { next.notifications = { product: preferences.product, email: preferences.email, security: preferences.security } }, 'account', '通知偏好已更新')
    },
    async changePassword(input, context) {
      checkPassword(input.currentPassword)
      if (input.newPassword !== DEMO_ACCOUNT_VALUES.newPassword) fail('DEMO_NEXT_PASSWORD_ONLY', '请使用固定新示例密码，勿输入真实密码。')
      if (input.newPassword !== input.confirmPassword) fail('PASSWORD_MISMATCH', '两次输入的新密码不一致。')
      await pause(context)
      return commit(context, next => { next.security.passwordUpdatedAt = new Date(now()).toISOString() }, 'credentials', '密码修改演示已完成')
    },
    async requestEmailChangeCode(input, context) {
      checkPassword(input.currentPassword)
      const email = input.email.trim().toLowerCase()
      if (email !== DEMO_ACCOUNT_VALUES.email) fail('DEMO_EMAIL_ONLY', '请使用固定新示例邮箱，勿输入真实邮箱。')
      if (state.email === email) fail('EMAIL_UNCHANGED', '当前已是此示例邮箱。')
      if (emailIssue && now() < emailIssue.resendAt) fail('CODE_COOLDOWN', '请稍后再获取演示码。')
      const issue = ++issueCounter
      await pause(context)
      if (issue !== issueCounter) fail('CANCELLED', '已有新的发码请求，本次结果已失效。')
      emailIssue = { id: issue, email, expiresAt: now() + 120_000, resendAt: now() + 30_000 }
      return { expiresAt: emailIssue.expiresAt, retryAfter: 30, demoCode: DEMO_ACCOUNT_VALUES.code }
    },
    async changeEmail(input, context) {
      const email = input.email.trim().toLowerCase(), issue = emailIssue?.id
      await pause(context)
      if (!emailIssue || issue !== emailIssue.id || emailIssue.email !== email) fail('EMAIL_CODE_REQUIRED', '请先验证示例密码并获取本次邮箱演示码。')
      if (now() >= emailIssue.expiresAt) fail('EMAIL_CODE_EXPIRED', '邮箱验证码已过期，请重新获取。')
      if (input.code.trim() !== DEMO_ACCOUNT_VALUES.code) fail('EMAIL_CODE_INVALID', '演示验证码不正确。')
      const result = commit(context, next => { next.email = email }, 'credentials', '邮箱更换演示已完成')
      emailIssue = undefined
      return result
    },
    async revokeDevice(id, context) {
      await pause(context)
      return commit(context, next => {
        const device = next.devices.find(item => item.id === id)
        if (!device) fail('DEVICE_NOT_FOUND', '未找到此设备，请刷新列表。')
        if (device.current) fail('CURRENT_DEVICE_PROTECTED', '不能退出当前演示设备。')
        next.devices = next.devices.filter(item => item.id !== id)
      }, 'devices', '示例设备已退出')
    },
    async revokeOtherDevices(context) {
      await pause(context)
      checkRevision(context)
      if (!state.devices.some(device => !device.current)) return snapshot()
      return commit(context, next => { next.devices = next.devices.filter(device => device.current) }, 'devices', '其他示例设备已退出')
    },
    async markMessageRead(id, context) {
      await pause(context)
      const message = state.messages.find(item => item.id === id)
      if (!message) fail('MESSAGE_NOT_FOUND', '未找到此消息。')
      if (message.read) return snapshot()
      return commit(context, next => { const message = next.messages.find(item => item.id === id); if (message) message.read = true }, 'account', '消息已标为已读')
    },
    async markAllMessagesRead(context) {
      await pause(context)
      if (state.messages.every(message => message.read)) return snapshot()
      return commit(context, next => { next.messages.forEach(message => { message.read = true }) }, 'account', '全部消息已标为已读')
    },
    async setTwoStep(input, context) {
      checkPassword(input.currentPassword)
      if (input.code.trim() !== DEMO_ACCOUNT_VALUES.code) fail('DEMO_CODE_ONLY', '请输入固定模拟验证码；这不是真实两步验证。')
      await pause(context)
      if (state.security.twoStepEnabled === input.enabled) return snapshot()
      return commit(context, next => { next.security.twoStepEnabled = input.enabled }, 'credentials', input.enabled ? '两步验证开启演示已完成' : '两步验证关闭演示已完成')
    },
  }
}
