import type { AccountSnapshot } from './types'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === 'string')
const optionalString = (value: unknown) => value === undefined || typeof value === 'string'
const list = (value: unknown, check: (item: Record<string, unknown>) => boolean) =>
  Array.isArray(value) && value.every((item) => object(item) && check(item))

/** Reject malformed adapter payloads before any render or reactive snapshot replacement. */
export function isAccountSnapshot(value: unknown): value is AccountSnapshot {
  if (!object(value) || !strings(value, ['revision', 'email'])) return false
  const { profile, notifications, security } = value
  return (
    object(profile) &&
    strings(profile, ['id', 'nickname', 'bio', 'avatar']) &&
    ['iris', 'teal', 'sun', 'graphite'].includes(profile.avatar as string) &&
    optionalString(profile.avatarUrl) &&
    object(notifications) &&
    ['product', 'email', 'security'].every((key) => typeof notifications[key] === 'boolean') &&
    object(security) &&
    typeof security.twoStepEnabled === 'boolean' &&
    optionalString(security.passwordUpdatedAt) &&
    list(
      value.devices,
      (item) =>
        strings(item, ['id', 'name', 'platform', 'location', 'lastActiveAt']) &&
        typeof item.current === 'boolean',
    ) &&
    list(
      value.messages,
      (item) =>
        strings(item, ['id', 'title', 'summary', 'body', 'createdAt']) &&
        ['security', 'product', 'account'].includes(item.category as string) &&
        typeof item.read === 'boolean',
    ) &&
    list(
      value.activity,
      (item) =>
        strings(item, ['id', 'title', 'description', 'at']) &&
        ['account', 'credentials', 'devices'].includes(item.category as string),
    )
  )
}
