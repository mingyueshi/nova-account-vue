import { describe, expect, it, vi } from 'vitest'
import { createFetchAdapter, type FetchAdapterOptions } from '../examples/adapters/fetch'
import { createInitialAccount } from '../demo/account'
import type { MutationContext } from '../src/types'

function setup(fetcher: typeof fetch) {
  const snapshot = createInitialAccount(Date.now())
  const invalid = () => {
    throw new Error('Missing decoder')
  }
  const options: FetchAdapterOptions = {
    baseUrl: '/api/account/',
    csrfToken: () => 'host-csrf-token',
    fetch: fetcher,
    decode: {
      challenge: invalid,
      proof: invalid,
      delivery: invalid,
      auth: invalid,
      reset: invalid,
      snapshot: (value) => {
        if (!value || typeof value !== 'object' || !('revision' in value))
          throw new Error('Invalid snapshot')
        return snapshot
      },
    },
  }
  const controller = new AbortController()
  const context: MutationContext = {
    signal: controller.signal,
    revision: 'r1',
    requestId: 'correlation-only',
  }
  return { adapter: createFetchAdapter(options), context, controller, options, snapshot }
}

describe('copyable fetch adapter transport', () => {
  it('forwards cancellation, CSRF, revision and desired input without adding retries', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ revision: 'r2' }))
    const { adapter, context, snapshot } = setup(fetcher)
    await expect(adapter.account.markMessageRead('message/one', context)).resolves.toBe(snapshot)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('/api/account/messages/message%2Fone/read')
    expect(init).toMatchObject({
      signal: context.signal,
      credentials: 'same-origin',
      method: 'POST',
    })
    const headers = new Headers(init!.headers)
    expect(headers.get('If-Match')).toBe('"r1"')
    expect(headers.get('X-CSRF-Token')).toBe('host-csrf-token')
    expect(headers.get('X-Request-ID')).toBe('correlation-only')
    expect(headers.has('Idempotency-Key')).toBe(false)
  })
  it('maps a proxy conflict safely and never retries it', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response('private proxy stack', { status: 412 }),
    )
    const { adapter, context } = setup(fetcher)
    await expect(adapter.account.revokeOtherDevices(context)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('maps recognized expiry codes while suppressing raw service messages', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ code: 'RESET_EXPIRED', message: 'private secret' }, { status: 400 }),
    )
    const { adapter, context } = setup(fetcher)
    await expect(
      adapter.auth.resetPassword(
        { email: 'synthetic@example.test', password: 'example', verificationToken: 'example' },
        context,
      ),
    ).rejects.toMatchObject({
      code: 'RESET_EXPIRED',
      message: 'Request a new password reset code.',
    })
  })
  it('treats transport failure as an unknown outcome and supports void 204 success', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network internals'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { adapter, context } = setup(fetcher)
    await expect(adapter.auth.logout(context)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(adapter.auth.logout(context)).resolves.toBeUndefined()
  })
  it('rejects malformed success and does not fetch after cancellation during CSRF lookup', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ wrong: true }))
    const { options, context, controller } = setup(fetcher)
    await expect(createFetchAdapter(options).account.load(context)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    fetcher.mockClear()
    options.csrfToken = async () => {
      controller.abort()
      return 'example'
    }
    await expect(createFetchAdapter(options).auth.logout(context)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
