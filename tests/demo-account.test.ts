import { describe, expect, it } from 'vitest'
import { createDemoAccountAdapter } from '../demo/account'
import type { MutationContext } from '../src/types'
const options = { wait: async () => {} }
const ctx = (revision: string): MutationContext => ({
  signal: new AbortController().signal,
  requestId: 'test',
  revision,
})
const tinyPng = 'data:image/png;base64,iVBORw0KGgo='

describe('demo account adapter avatar capability', () => {
  it('stores and clears avatarUrl through revisions', async () => {
    const adapter = createDemoAccountAdapter(options)
    const uploadAvatar = adapter.uploadAvatar!
    const uploaded = await uploadAvatar({ dataUrl: tinyPng }, ctx('0'))
    expect(uploaded.profile.avatarUrl).toBe(tinyPng)
    const cleared = await uploadAvatar({ dataUrl: null }, ctx(uploaded.revision))
    expect(cleared.profile.avatarUrl).toBe('')
  })
  it('rejects non-images and oversized data URLs before any wait', async () => {
    const adapter = createDemoAccountAdapter(options)
    const uploadAvatar = adapter.uploadAvatar!
    await expect(
      uploadAvatar({ dataUrl: 'data:text/html;base64,PGI+' }, ctx('0')),
    ).rejects.toMatchObject({ code: 'AVATAR_TYPE' })
    await expect(
      uploadAvatar({ dataUrl: `data:image/png;base64,${'A'.repeat(2_800_001)}` }, ctx('0')),
    ).rejects.toMatchObject({ code: 'AVATAR_SIZE' })
  })
  it('updateProfile preserves an existing avatarUrl', async () => {
    const adapter = createDemoAccountAdapter(options)
    const uploaded = await adapter.uploadAvatar!({ dataUrl: tinyPng }, ctx('0'))
    const next = await adapter.updateProfile(
      { nickname: '改名', bio: '', avatar: 'teal' },
      ctx(uploaded.revision),
    )
    expect(next.profile.nickname).toBe('改名')
    expect(next.profile.avatar).toBe('teal')
    expect(next.profile.avatarUrl).toBe(tinyPng)
  })
})
