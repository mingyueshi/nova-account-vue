import { NovaError } from '../src/types'
import type {
  AccountAdapter,
  AccountSnapshot,
  Activity,
  MutationContext,
  NotificationPreferenceRow,
  RequestContext,
} from '../src/types'
import { DEMO_EMAIL } from './auth'
import type { DemoSettings, DemoIdentities } from './auth'

export const DEMO_ACCOUNT_VALUES = {
  currentPassword: '123456',
  newPassword: '654321',
  confirmPassword: '654321',
  email: 'next@demo.com',
  code: '123456',
} as const

export const demoNotificationPreferences: NotificationPreferenceRow[] = [
  {
    eventId: 'product',
    label: '产品动态',
    channels: { email: { enabled: false }, inApp: { enabled: true }, push: { enabled: false } },
  },
  {
    eventId: 'security',
    label: '安全提醒',
    channels: {
      email: { enabled: true, readOnly: true },
      inApp: { enabled: true },
      push: { enabled: false },
    },
  },
  {
    eventId: 'digest',
    label: '账户摘要',
    channels: { email: { enabled: true }, inApp: { enabled: false } },
  },
]

interface DemoAccountOptions {
  notificationPreferences?: NotificationPreferenceRow[]
  wait?: (signal: AbortSignal) => Promise<void>
  now?: () => number
  settings?: () => DemoSettings
  identities?: DemoIdentities
}
const clone = <T>(value: T): T => structuredClone(value)
function fail(code: string, message: string): never {
  throw new NovaError(code, message)
}
const assertActive = (context: RequestContext) => {
  if (context.signal.aborted) fail('CANCELLED', '操作已取消。')
}

export function createInitialAccount(
  time: number,
  notificationPreferences?: NotificationPreferenceRow[],
): AccountSnapshot {
  const at = (offset = 0) => new Date(time + offset).toISOString()
  return {
    revision: '0',
    ...(notificationPreferences && { notificationPreferences: clone(notificationPreferences) }),
    profile: {
      id: 'nova-demo',
      nickname: 'Nova',
      bio: '把灵感，慢慢变成日常。',
      avatar: 'iris',
      avatarUrl: '',
    },
    email: DEMO_EMAIL,
    notifications: { product: true, email: false, security: true },
    security: { twoStepEnabled: false },
    devices: [
      {
        id: 'current',
        name: 'Mac · Chrome',
        platform: 'macOS',
        location: '上海',
        lastActiveAt: at(),
        current: true,
      },
      {
        id: 'phone',
        name: 'iPhone · Safari',
        platform: 'iOS',
        location: '杭州',
        lastActiveAt: at(-86_400_000),
        current: false,
      },
      {
        id: 'desktop',
        name: 'Windows · Edge',
        platform: 'Windows',
        location: '北京',
        lastActiveAt: at(-259_200_000),
        current: false,
      },
    ],
    messages: [
      {
        id: 'new-device',
        title: '新设备登录提醒',
        summary: '你的账户在 Mac · Chrome 上登录。',
        body: '你的账户在上海通过 Mac · Chrome 登录。\n\n如果这不是你的操作，请前往登录设备退出该会话，并及时修改密码。',
        category: 'security',
        createdAt: at(-900_000),
        read: false,
      },
      {
        id: 'welcome-space',
        title: '欢迎使用账户空间',
        summary: '资料、安全与偏好，集中在一个地方。',
        body: '个人资料、通知偏好和安全设置，现在都可以在账户空间中统一管理。\n\n从完善个人简介开始，让大家更好地认识你。',
        category: 'product',
        createdAt: at(-7_200_000),
        read: false,
      },
      {
        id: 'hello',
        title: '开始完善个人资料',
        summary: '上传头像，写一句喜欢的个人简介。',
        body: '选择喜欢的头像，更新你的昵称与简介。\n\n你的个人资料会在账户空间中展示，也可以随时修改。',
        category: 'account',
        createdAt: at(-86_400_000),
        read: false,
      },
      {
        id: 'security',
        title: '定期检查登录设备',
        summary: '及时退出不再使用的设备，保护账户安全。',
        body: '在登录设备中查看最近活动。发现不熟悉的设备时，可以退出单个会话或一次退出其他设备。',
        category: 'security',
        createdAt: at(-172_800_000),
        read: true,
      },
      {
        id: 'notifications',
        title: '让通知更合你的习惯',
        summary: '选择想看到的产品、邮件与安全提醒。',
        body: '在通知偏好中选择产品动态、邮件摘要和安全提醒。\n\n修改完成后，请保存偏好，让通知更合你的习惯。',
        category: 'product',
        createdAt: at(-259_200_000),
        read: false,
      },
      {
        id: 'about',
        title: '资料更新小贴士',
        summary: '保存修改前，你可以随时取消编辑。',
        body: '编辑资料或通知偏好时，离开页面前会提醒你保存尚未提交的修改。',
        category: 'account',
        createdAt: at(-345_600_000),
        read: true,
      },
    ],
    activity: [
      {
        id: 'ready',
        category: 'account',
        title: '个人资料已更新',
        description: '头像、昵称与个人简介已保存。',
        at: at(),
      },
      {
        id: 'login',
        category: 'devices',
        title: '新设备登录',
        description: 'Mac · Chrome 在上海登录。',
        at: at(-900_000),
      },
      {
        id: 'device',
        category: 'devices',
        title: '设备登录',
        description: 'iPhone · Safari 在杭州登录。',
        at: at(-86_400_000),
      },
      {
        id: 'password',
        category: 'credentials',
        title: '登录密码已设置',
        description: '账户密码设置完成。',
        at: at(-172_800_000),
      },
    ],
  }
}

/** Synthetic data only. Not included in the library build. No network or persistence. */
export function createDemoAccountAdapter({
  wait = () => new Promise((resolve) => setTimeout(resolve, 350)),
  now = Date.now,
  settings,
  identities,
  notificationPreferences,
}: DemoAccountOptions = {}): AccountAdapter {
  let state = createInitialAccount(now(), notificationPreferences)
  let issueCounter = 0
  let emailIssue: { id: number; email: string; expiresAt: number; resendAt: number } | undefined
  const snapshot = () => clone(state)
  const checkRevision = (context: MutationContext) => {
    assertActive(context)
    if (context.revision !== state.revision)
      fail('REVISION_CONFLICT', '资料已发生变化，请重新加载后再试。')
  }
  const pause = async (context: RequestContext) => {
    assertActive(context)
    applyExternalEditIfArmed()
    await wait(context.signal)
    assertActive(context)
  }
  /** One-shot external edit per arming; the next host mutation then reports a revision conflict. */
  let conflictConsumed = true
  function applyExternalEditIfArmed() {
    if (settings?.().conflict !== 'dirty') {
      conflictConsumed = false
      return
    }
    if (conflictConsumed) return
    conflictConsumed = true
    const next = snapshot()
    next.revision = String(Number(state.revision) + 1)
    next.profile = { ...next.profile, nickname: 'Nova（另一设备）' }
    next.activity.unshift({
      id: `activity-external-${next.revision}`,
      category: 'account',
      title: '其他设备更新了个人资料',
      description: '资料发生变动，请刷新后查看最新内容。',
      at: new Date(now()).toISOString(),
    })
    next.activity = next.activity.slice(0, 24)
    state = next
  }
  function commit(
    context: MutationContext,
    update: (next: AccountSnapshot) => void,
    category: Activity['category'],
    title: string,
  ) {
    checkRevision(context)
    const next = snapshot()
    update(next)
    next.revision = String(Number(state.revision) + 1)
    next.activity.unshift({
      id: `activity-${next.revision}`,
      category,
      title,
      description: '更改已保存，可在相应页面查看。',
      at: new Date(now()).toISOString(),
    })
    next.activity = next.activity.slice(0, 24)
    state = next
    return snapshot()
  }
  function checkPassword(password: string) {
    if (password !== (identities?.current.password ?? DEMO_ACCOUNT_VALUES.currentPassword))
      fail('PASSWORD_INVALID', '当前密码不正确。')
  }
  return {
    async load(context) {
      await pause(context)
      if (identities && state.profile.id !== identities.current.user.id) {
        state = createInitialAccount(now(), notificationPreferences)
        state.profile.id = identities.current.user.id
        state.profile.nickname = identities.current.user.displayName
      }
      if (identities) state.email = identities.current.user.email
      return snapshot()
    },
    async updateProfile(profile, context) {
      const nickname = profile.nickname.trim(),
        bio = profile.bio.trim()
      // eslint-disable-next-line no-control-regex -- Deliberately reject control characters in synthetic data.
      if (!nickname || [...nickname].length > 24 || /[\u0000-\u001f\u007f]/.test(nickname))
        fail('PROFILE_NICKNAME', '昵称需为 1–24 个字符，且不能包含控制字符。')
      // eslint-disable-next-line no-control-regex -- Deliberately reject control characters in synthetic data.
      if ([...bio].length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(bio))
        fail('PROFILE_BIO', '简介最多 120 个字符，且不能包含控制字符。')
      if (!['iris', 'teal', 'sun', 'graphite'].includes(profile.avatar))
        fail('PROFILE_AVATAR', '请选择一个预设头像。')
      await pause(context)
      return commit(
        context,
        (next) => {
          next.profile = {
            ...next.profile,
            id: state.profile.id,
            nickname,
            bio,
            avatar: profile.avatar,
            avatarUrl: profile.avatarUrl ?? state.profile.avatarUrl,
          }
        },
        'account',
        '个人资料已更新',
      )
    },
    async updateNotifications(preferences, context) {
      if (
        [preferences.product, preferences.email, preferences.security].some(
          (value) => typeof value !== 'boolean',
        )
      )
        fail('PREFERENCES_INVALID', '通知选项必须为开启或关闭。')
      await pause(context)
      return commit(
        context,
        (next) => {
          next.notifications = {
            product: preferences.product,
            email: preferences.email,
            security: preferences.security,
          }
        },
        'account',
        '通知偏好已更新',
      )
    },
    async updateNotificationPreferences(changes, context) {
      await pause(context)
      return commit(
        context,
        (next) => {
          for (const { eventId, channel, enabled } of changes) {
            const row = next.notificationPreferences?.find((item) => item.eventId === eventId)
            const cell =
              row && Object.hasOwn(row.channels, channel) ? row.channels[channel] : undefined
            if (!cell || cell.readOnly || typeof enabled !== 'boolean')
              fail('PREFERENCES_INVALID', '此通知选项无法修改。')
            cell.enabled = enabled
          }
        },
        'account',
        '通知偏好已更新',
      )
    },
    async changePassword(input, context) {
      checkPassword(input.currentPassword)
      if (input.newPassword.length < 6 || input.newPassword.length > 128)
        fail('PASSWORD_INVALID', '密码长度应为 6–128 位。')
      if (input.newPassword !== input.confirmPassword)
        fail('PASSWORD_MISMATCH', '两次输入的新密码不一致。')
      await pause(context)
      return commit(
        context,
        (next) => {
          next.security.passwordUpdatedAt = new Date(now()).toISOString()
          if (identities) identities.current.password = input.newPassword
        },
        'credentials',
        '登录密码已更新',
      )
    },
    async requestEmailChangeCode(input, context) {
      checkPassword(input.currentPassword)
      const email = input.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('EMAIL_INVALID', '请输入有效的邮箱地址。')
      if (identities?.find(email)) fail('EMAIL_TAKEN', '该邮箱已被使用。')
      if (state.email === email) fail('EMAIL_UNCHANGED', '当前已绑定此邮箱。')
      if (emailIssue && now() < emailIssue.resendAt) fail('CODE_COOLDOWN', '请稍后再获取验证码。')
      const issue = ++issueCounter
      await pause(context)
      if (issue !== issueCounter) fail('CANCELLED', '已有新的发码请求，本次结果已失效。')
      emailIssue = { id: issue, email, expiresAt: now() + 120_000, resendAt: now() + 30_000 }
      return { expiresAt: emailIssue.expiresAt, retryAfter: 30 }
    },
    async changeEmail(input, context) {
      const email = input.email.trim().toLowerCase(),
        issue = emailIssue?.id
      await pause(context)
      if (!emailIssue || issue !== emailIssue.id || emailIssue.email !== email)
        fail('EMAIL_CODE_REQUIRED', '请先验证当前密码并获取邮箱验证码。')
      if (now() >= emailIssue.expiresAt)
        fail('EMAIL_CODE_EXPIRED', '邮箱验证码已过期，请重新获取。')
      if (input.code.trim() !== DEMO_ACCOUNT_VALUES.code)
        fail('EMAIL_CODE_INVALID', '验证码不正确，请重新输入。')
      const result = commit(
        context,
        (next) => {
          next.email = email
          identities?.changeEmail(email)
        },
        'credentials',
        '绑定邮箱已更新',
      )
      emailIssue = undefined
      return result
    },
    async revokeDevice(id, context) {
      await pause(context)
      return commit(
        context,
        (next) => {
          const device = next.devices.find((item) => item.id === id)
          if (!device) fail('DEVICE_NOT_FOUND', '未找到此设备，请刷新列表。')
          if (device.current) fail('CURRENT_DEVICE_PROTECTED', '请使用退出登录结束当前设备的会话。')
          next.devices = next.devices.filter((item) => item.id !== id)
        },
        'devices',
        '示例设备已退出',
      )
    },
    async revokeOtherDevices(context) {
      await pause(context)
      checkRevision(context)
      if (!state.devices.some((device) => !device.current)) return snapshot()
      return commit(
        context,
        (next) => {
          next.devices = next.devices.filter((device) => device.current)
        },
        'devices',
        '其他示例设备已退出',
      )
    },
    async markMessageRead(id, context) {
      await pause(context)
      const message = state.messages.find((item) => item.id === id)
      if (!message) fail('MESSAGE_NOT_FOUND', '未找到此消息。')
      if (message.read) return snapshot()
      return commit(
        context,
        (next) => {
          const message = next.messages.find((item) => item.id === id)
          if (message) message.read = true
        },
        'account',
        '消息已标为已读',
      )
    },
    async markAllMessagesRead(context) {
      await pause(context)
      if (state.messages.every((message) => message.read)) return snapshot()
      return commit(
        context,
        (next) => {
          next.messages.forEach((message) => {
            message.read = true
          })
        },
        'account',
        '全部消息已标为已读',
      )
    },
    async uploadAvatar(input, context) {
      if (input.dataUrl !== null) {
        if (!input.dataUrl.startsWith('data:image/')) fail('AVATAR_TYPE', '请选择图片文件。')
        // Base64 data URLs carry ~4/3 overhead; 2.8M chars ≈ a 2 MB image.
        if (input.dataUrl.length > 2_800_000) fail('AVATAR_SIZE', '头像图片不能超过 2 MB。')
      }
      await pause(context)
      if (input.dataUrl === null && !state.profile.avatarUrl) return snapshot()
      return commit(
        context,
        (next) => {
          next.profile = { ...next.profile, avatarUrl: input.dataUrl ?? '' }
        },
        'account',
        input.dataUrl === null ? '头像已移除' : '头像已更新',
      )
    },
    async setTwoStep(input, context) {
      checkPassword(input.currentPassword)
      if (input.code.trim() !== DEMO_ACCOUNT_VALUES.code)
        fail('DEMO_CODE_ONLY', '确认码不正确，请重新输入。')
      await pause(context)
      if (state.security.twoStepEnabled === input.enabled) return snapshot()
      return commit(
        context,
        (next) => {
          next.security.twoStepEnabled = input.enabled
        },
        'credentials',
        input.enabled ? '已开启两步验证' : '已关闭两步验证',
      )
    },
  }
}
