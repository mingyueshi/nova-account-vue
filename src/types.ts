/** Presentation contracts. Authorization and credential verification belong to the server. */
export type ThemeMode = 'light' | 'dark' | 'system'
export type Accent = 'iris' | 'blue' | 'teal' | 'amber'
export interface Appearance { mode: ThemeMode; accent: Accent }
export type AuthMode = 'password' | 'code' | 'register' | 'reset'
export type CaptchaPurpose = 'login-password' | 'login-code' | 'register' | 'reset-password'
export type CodePurpose = Exclude<CaptchaPurpose, 'login-password'>
export interface RequestContext { signal: AbortSignal; requestId: string }
export interface Challenge { id: string; expiresAt: number; kind: 'slider' | 'custom'; label?: string }
export interface CaptchaProof { token: string; expiresAt: number }
export interface CodeDelivery { expiresAt: number; retryAfter: number; /** Only synthetic demo adapters may return this. */ demoCode?: string }
export interface SessionUser { id: string; email: string; displayName: string }
export interface AuthResult { user: SessionUser }
export interface ResetVerification { token: string; expiresAt: number }
export interface AuthAdapter {
  /** Challenge implementation may require a custom UI via NovaAuthForm's captcha slot. */
  challenge(input: { email: string; purpose: CaptchaPurpose }, context: RequestContext): Promise<Challenge>
  verifyCaptcha(input: { challengeId: string; email: string; purpose: CaptchaPurpose; response: unknown }, context: RequestContext): Promise<CaptchaProof>
  sendCode(input: { email: string; purpose: CodePurpose; proof: string }, context: RequestContext): Promise<CodeDelivery>
  login(input: { email: string; method: 'password'; password: string; proof: string } | { email: string; method: 'code'; code: string }, context: RequestContext): Promise<AuthResult>
  register(input: { email: string; password: string; code: string; consent: boolean }, context: RequestContext): Promise<AuthResult>
  verifyResetCode(input: { email: string; code: string }, context: RequestContext): Promise<ResetVerification>
  resetPassword(input: { email: string; password: string; verificationToken: string }, context: RequestContext): Promise<void>
  logout(context: RequestContext): Promise<void>
}
export interface Profile { id: string; nickname: string; bio: string; avatar: 'iris' | 'teal' | 'sun' | 'graphite' }
export interface NotificationPreferences { product: boolean; email: boolean; security: boolean }
export interface Device { id: string; name: string; platform: string; location: string; lastActiveAt: string; current: boolean }
export interface AccountMessage { id: string; title: string; summary: string; body: string; category: 'security' | 'product' | 'account'; createdAt: string; read: boolean }
export interface Activity { id: string; category: 'account' | 'credentials' | 'devices'; title: string; description: string; at: string }
export interface AccountSnapshot {
  revision: string; profile: Profile; email: string; notifications: NotificationPreferences; devices: Device[]; messages: AccountMessage[];
  security: { twoStepEnabled: boolean; passwordUpdatedAt?: string }; activity: Activity[]
}
export interface MutationContext extends RequestContext { revision: string }
export interface AccountAdapter {
  load(context: RequestContext): Promise<AccountSnapshot>
  updateProfile(profile: Omit<Profile, 'id'>, context: MutationContext): Promise<AccountSnapshot>
  updateNotifications(preferences: NotificationPreferences, context: MutationContext): Promise<AccountSnapshot>
  changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }, context: MutationContext): Promise<AccountSnapshot>
  requestEmailChangeCode(input: { email: string; currentPassword: string }, context: RequestContext): Promise<CodeDelivery>
  changeEmail(input: { email: string; code: string }, context: MutationContext): Promise<AccountSnapshot>
  revokeDevice(id: string, context: MutationContext): Promise<AccountSnapshot>
  revokeOtherDevices(context: MutationContext): Promise<AccountSnapshot>
  markMessageRead(id: string, context: MutationContext): Promise<AccountSnapshot>
  markAllMessagesRead(context: MutationContext): Promise<AccountSnapshot>
  /** Two-step is an adapter workflow hook, not a TOTP implementation. Production should replace the security slot. */
  setTwoStep(input: { enabled: boolean; currentPassword: string; code: string }, context: MutationContext): Promise<AccountSnapshot>
}
export interface NovaAdapter { auth: AuthAdapter; account: AccountAdapter; /** Explicit UI disclosure, never an authorization flag. */ simulated?: boolean }
export type AccountPage = 'overview' | 'profile' | 'security' | 'devices' | 'notifications' | 'messages' | 'appearance'
export class NovaError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'NovaError' }
}
