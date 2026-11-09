# Nova Account Vue

[简体中文](README.md) · [MIT](LICENSE) · Development version `0.1.0-dev.1`

Vue 3 + TypeScript account presentation components with injected business adapters and precompiled, scoped Tailwind CSS. Includes sign-in, registration, password reset, profiles, messages, devices, appearance and security presentation. The standalone demo uses synthetic in-memory data. This library does not provide a production authentication backend.

## Develop and verify

Requires Node >=22.12 and Vue ^3.5. This is an **ESM-only** package; no CommonJS entry is distributed.

```sh
npm ci
npm run check           # lint, formatting, strict types, coverage, builds, size budgets
npm run verify:package  # actual tarball, independent strict TypeScript / ESM / CSS / SSR consumer
npm run verify:nuxt     # Nuxt 3 and 4: locked tarball consumers, typecheck, build and SSR smoke
npx playwright install chromium firefox webkit
npm run test:e2e        # temporary loopback demo, keyboard flows, viewports and axe scans
```

GitHub Actions configurations run those checks on pushes and pull requests. Adding the configurations does not mean remote CI has run; see [QA.md](QA.md) for recorded local evidence and remaining acceptance work.

The package is private and has not been published to npm. Build and run `npm pack`, then install the generated tarball in the consumer. Import the stylesheet explicitly; the consumer does not need Tailwind.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NovaAccount, type AccountPage } from 'nova-account'
import 'nova-account/style.css'
import { createSiteAdapter } from './account-adapter'

const adapter = createSiteAdapter()
const page = ref<AccountPage>('messages')
</script>

<template>
  <NovaAccount
    v-model:page="page"
    :adapter="adapter"
    locale="en-US"
    time-zone="Europe/London"
    layout="embedded"
  />
</template>
```

## Configuration

- Default language: `zh-CN`. Built-in `en-US` and typed partial `messages` overrides apply to all library components, validation and accessibility labels. Existing built-in field validation errors update when the locale or messages change. Host adapter errors, user content and custom slots are translated by the host.
- Configure locale and dates on `NovaAccount` or `NovaTheme`, or call `provideNovaLocale(() => options)` in component setup. No global locale singleton or vue-i18n dependency is required.
- `timeZone` defaults to UTC for deterministic SSR. Use `dateTimeOptions` for Intl options or `formatTime` for a host formatter; server and client must use matching settings.
- `page` / `update:page` provide controlled navigation; `initialPage` initializes uncontrolled mode. `pageChange` reports committed changes. External prop changes are authoritative; implement host router leave guards for forced route changes or unmounts.
- `layout` defaults to `full`; `embedded` retains header / footer and uses natural page height. Standalone components should be placed inside `NovaTheme`.
- `NovaField` supports input / textarea, native input attributes, `maxlength`, descriptions and prefix / suffix slots. Code length defaults to 6 and is configurable through `codeLength`; `null` removes the limit.
- Optional `passwordStrength(password)` returns `{ score: 0..4, label, hint? }` for new-password presentation. It does not enforce password policy or block submission.
- `useAccount().requestResult(operation)` distinguishes `success`, `busy`, `cancelled` and `error`; the original `request()` API retains its `T | undefined` behavior. No automatic replay is performed.

## Host responsibilities

Provide real adapters and runtime response validation. Replace `captcha` and `security` slots with the host's real verification and reauthentication flows. The `simulated` flag is a disclosure switch and does not grant permissions. `initialUser` is display data for a server-verified session, not proof of authentication.

The host must handle authorization, CSRF, password policy and storage, rate limiting, email delivery, session revocation, revision conflicts and unknown outcomes. Aborting a request only suppresses stale UI updates; it does not undo server work. Request IDs are correlation IDs, not durable idempotency keys. Only appearance settings may optionally use localStorage; credentials and account data are never persisted by the library.

See [contracts](docs/contracts.md), [fetch adapter skeleton](docs/adapter.md), [production checklist](docs/production-checklist.md), [Nuxt integration](docs/nuxt.md), [changelog](CHANGELOG.md) and [QA evidence](QA.md). Visual screenshot artifacts and axe scans do not constitute screen-reader, real-device or production-backend acceptance.

### Host feature selection

`NovaAccount` forwards `identifier`, `modes`, `pages`, and `twoStep` to its standalone components:

- `identifier="username"` trims the account name without changing case and keeps the adapter wire field named `email`. Email mode retains lowercase normalization. Runtime identifier changes cancel the old flow and clear credentials. `useAuthFlow` accepts a ref or getter as well as a literal identifier.
- `modes` limits the password, code, register, and reset flows. If password is unavailable initially, the first supplied mode is selected. Removing the active flow cancels it and selects the first remaining mode. Back-to-login uses an available login flow; exposed `setMode` rejects disabled flows. An empty list hides the built-in form while keeping the footer slot.
- `pages` limits sidebar entries, overview shortcuts, and rendered pages. Invalid initial/current pages fall back to the first visible page in the component's canonical navigation order. An empty list renders no account page. Controlled fallback does not emit `update:page`; `pageChange` reports actual displayed page changes. Runtime removal is an authoritative host navigation, so hosts should confirm before removing an edited page if drafts must be retained.
- `twoStep` defaults to `true`. Setting it to `false` removes the built-in action and cancels/closes its current dialog.

These are presentation options, not server authorization. Aborting an operation does not prove server rollback.
