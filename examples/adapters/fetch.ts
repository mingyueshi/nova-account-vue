import { NOVA_ERROR_CODES, NovaError } from '../../src/types'
import type {
  AccountSnapshot,
  AuthResult,
  CaptchaProof,
  Challenge,
  CodeDelivery,
  NovaAdapter,
  NovaErrorCode,
  RequestContext,
  ResetVerification,
} from '../../src/types'

type Decoder<T> = (value: unknown) => T
export interface FetchAdapterOptions {
  /** Same-origin example: /api/account. Configure routing and cookies on the host. */
  baseUrl: string
  csrfToken: () => string | Promise<string>
  fetch?: typeof globalThis.fetch
  /** Supply runtime schema decoders for YOUR API. A TypeScript cast is not validation. */
  decode: {
    challenge: Decoder<Challenge>
    proof: Decoder<CaptchaProof>
    delivery: Decoder<CodeDelivery>
    auth: Decoder<AuthResult>
    reset: Decoder<ResetVerification>
    snapshot: Decoder<AccountSnapshot>
  }
  errorMessages?: Partial<Record<NovaErrorCode, string>>
}

const safeMessages: Record<NovaErrorCode, string> = {
  VERIFICATION_EXPIRED: 'Verification expired. Verify again.',
  CHALLENGE_INVALID: 'Verification is unavailable.',
  PROOF_INVALID: 'Verification failed. Verify again.',
  PURPOSE_INVALID: 'This verification cannot be used for this action.',
  DELIVERY_INVALID: 'Check code delivery status before retrying.',
  RESET_INVALID: 'Request a new password reset code.',
  RESET_EXPIRED: 'Request a new password reset code.',
  RESET_REQUIRED: 'Verify your email first.',
  CODE_EXPIRED: 'The code has expired. Request a new one.',
  REVISION_CONFLICT: 'The account has changed. Reload and review your changes.',
  NETWORK_ERROR: 'The result is unknown. Check the operation status before retrying.',
  HTTP_ERROR: 'The service could not complete this request.',
  INVALID_RESPONSE: 'The service returned an unexpected response. Check the operation status.',
}

/** Copy into the host and change the import to 'nova-account'. Endpoint paths are examples.
 * No retries, browser token storage, implicit mock, or claim of server rollback. */
export function createFetchAdapter(options: FetchAdapterOptions): NovaAdapter {
  const fetcher = options.fetch ?? globalThis.fetch
  const base = options.baseUrl.replace(/\/$/, '')
  const failure = (code: NovaErrorCode) =>
    new NovaError(code, options.errorMessages?.[code] ?? safeMessages[code])

  async function request<T>(
    path: string,
    context: RequestContext,
    decode: Decoder<T>,
    body?: unknown,
    method = 'POST',
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json', 'X-Request-ID': context.requestId })
    if (method !== 'GET') {
      headers.set('Content-Type', 'application/json')
      const csrf = await options.csrfToken()
      if (!csrf) throw failure(NOVA_ERROR_CODES.HTTP_ERROR)
      headers.set('X-CSRF-Token', csrf)
    }
    if ('revision' in context && typeof context.revision === 'string')
      headers.set('If-Match', JSON.stringify(context.revision))
    // A slow token provider must not start a request after this UI was cancelled.
    context.signal.throwIfAborted()
    let response: Response
    try {
      response = await fetcher(`${base}${path}`, {
        method,
        headers,
        signal: context.signal,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (cause) {
      if (context.signal.aborted) throw cause
      throw failure(NOVA_ERROR_CODES.NETWORK_ERROR)
    }
    let payload: unknown
    if (response.status !== 204) {
      try {
        payload = await response.json()
      } catch {
        if (context.signal.aborted) context.signal.throwIfAborted()
        // Preserve conflict handling even when the proxy returns non-JSON error text.
        if (response.ok) throw failure(NOVA_ERROR_CODES.INVALID_RESPONSE)
      }
    }
    context.signal.throwIfAborted()
    if (!response.ok) {
      if (response.status === 409 || response.status === 412)
        throw failure(NOVA_ERROR_CODES.REVISION_CONFLICT)
      const code =
        payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
      // Never display the server's raw message, stack, HTML, or credentials.
      throw failure(
        typeof code === 'string' && Object.hasOwn(NOVA_ERROR_CODES, code)
          ? (code as NovaErrorCode)
          : NOVA_ERROR_CODES.HTTP_ERROR,
      )
    }
    try {
      return decode(payload)
    } catch {
      throw failure(NOVA_ERROR_CODES.INVALID_RESPONSE)
    }
  }
  const empty: Decoder<void> = () => undefined
  const { decode } = options
  return {
    auth: {
      challenge: (input, context) => request('/auth/challenge', context, decode.challenge, input),
      verifyCaptcha: (input, context) => request('/auth/verify', context, decode.proof, input),
      sendCode: (input, context) => request('/auth/code', context, decode.delivery, input),
      login: (input, context) => request('/auth/login', context, decode.auth, input),
      register: (input, context) => request('/auth/register', context, decode.auth, input),
      verifyResetCode: (input, context) =>
        request('/auth/reset/verify', context, decode.reset, input),
      resetPassword: (input, context) => request('/auth/reset', context, empty, input),
      logout: (context) => request('/auth/logout', context, empty),
    },
    account: {
      load: (context) => request('', context, decode.snapshot, undefined, 'GET'),
      updateProfile: (input, context) =>
        request('/profile', context, decode.snapshot, input, 'PATCH'),
      updateNotifications: (input, context) =>
        request('/notifications', context, decode.snapshot, input, 'PATCH'),
      changePassword: (input, context) => request('/password', context, decode.snapshot, input),
      requestEmailChangeCode: (input, context) =>
        request('/email/code', context, decode.delivery, input),
      changeEmail: (input, context) => request('/email', context, decode.snapshot, input),
      revokeDevice: (id, context) =>
        request(`/devices/${encodeURIComponent(id)}/revoke`, context, decode.snapshot),
      revokeOtherDevices: (context) => request('/devices/revoke-others', context, decode.snapshot),
      markMessageRead: (id, context) =>
        request(`/messages/${encodeURIComponent(id)}/read`, context, decode.snapshot),
      markAllMessagesRead: (context) => request('/messages/read-all', context, decode.snapshot),
      setTwoStep: (input, context) => request('/two-step', context, decode.snapshot, input),
    },
  }
}
