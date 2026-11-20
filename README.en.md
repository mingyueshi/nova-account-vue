# Nova Account Vue

[简体中文](README.md) · [MIT](LICENSE) · Development version `0.1.0-dev.2`

Vue 3 + TypeScript account presentation components with injected business adapters and precompiled, scoped Tailwind CSS. Includes sign-in, registration, password reset, profiles, messages, devices, appearance and security presentation. The standalone demo uses synthetic in-memory data. This library does not provide a production authentication backend.

## Develop and verify

Requires Node >=22.12 and Vue ^3.5. This is an **ESM-only** package; the require condition throws a descriptive error directing CommonJS callers to `await import(...)`, rather than providing a CommonJS implementation. Development pins are Node 22.19.0 (`.nvmrc`) and npm 10.9.3 (`packageManager`); CI also targets Node 22.12.0 and 24.

```sh
npm ci
npm run check           # lint, formatting, strict types, coverage, builds, size budgets
npm run pack:library    # isolated source build, then a local tarball; never packs shared dist
npm run verify:package  # isolated build and tarball, independent strict TypeScript / ESM / CSS / SSR
npm run verify:nuxt     # Nuxt 3 and 4: locked tarball consumers, typecheck, build and SSR smoke
npx playwright install chromium firefox webkit
npm run test:e2e        # temporary loopback demo, keyboard flows, viewports and axe scans
```

GitHub Actions configurations run those checks on pushes and pull requests. Adding the configurations does not mean remote CI has run; see [QA.md](QA.md) for recorded local evidence and remaining acceptance work.

The package is private and has not been published to npm. Run `npm run pack:library`, then install the generated tarball in the consumer. It builds a private source snapshot and checks bundled declarations before packing, so concurrent builds cannot change the package. Direct `npm pack` checks declarations and a content-hash receipt covering source, build configuration and all output files. It refuses stale, missing or modified outputs. Run `npm run build` to create the receipt; prepack does not rebuild or replace the isolated packaging pipeline. Both consumer verification scripts use the isolated pipeline. See [package verification](docs/package-build.md). Import the stylesheet explicitly; the consumer does not need Tailwind.

Jest hosts using CommonJS tests, or a transformer that converts `import` to `require`, resolve this package's `require` error entry and throw `ERR_REQUIRE_ESM` at runtime. Follow the [Jest ESM setup guide](https://jestjs.io/docs/ecmascript-modules) to enable ESM and preserve ESM transformer output; this package does not provide a CommonJS implementation.

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

## Workspaces and icons

The demo keeps business and component examples inside the account navigation. Wide content boxes use master/detail layouts for messages, tasks and orders, side-by-side editing and preview, and dedicated profile, notification and appearance workspaces. Container queries collapse these to one column when embedded or narrow.

`NovaIcon` uses static imports from [Lucide Vue](https://lucide.dev/guide/vue). Pass a built-in `name` (listed by `NOVA_ICON_NAMES`) or a Vue icon component through `icon`. Defaults: `size=20`, `strokeWidth=2`, `color="currentColor"`. Decorative icons are hidden from assistive technology; `label` provides named image semantics. Unknown names render `fallback` (default ◇).

```vue
<script setup lang="ts">
import { Camera } from '@lucide/vue'
import { NovaIcon } from 'nova-account'
</script>
<template>
  <NovaIcon name="security" :size="20" />
  <NovaIcon :icon="Camera" label="Camera" />
</template>
```

The integrated icon demo includes 55 searchable icons, size/stroke/color controls and component/SVG copying. Built-in icons are bundled, so account consumers do not install Lucide. Hosts importing extra icons such as Camera install `@lucide/vue` themselves. No CDN is required. [Third-party notices](THIRD_PARTY_NOTICES.md) include the Lucide ISC and derived Feather MIT licenses.

## Optional dynamic charts

Import `NovaChart` and `NovaChartOption` from `nova-account/charts`. This separate entry uses Apache ECharts 6.1.0, matching the backend chart lab; ECharts is an optional peer (`^6.1.0`), so the base account entry neither loads nor installs the chart engine. Run `npm install echarts@6.1.0` before importing the chart entry. Registered features: line, bar, pie/donut, tooltip, legend, range zoom and SVG rendering.

```vue
<NovaChart :option="option" label="Completed tasks" :height="320" :active="visible" />
```

Place charts inside `NovaTheme` to inherit the palette. The component observes container sizes and theme attributes, respects reduced motion, and disposes its instance and listeners on unmount. `active=false` suspends rendering. Provide `description` and a readable data table; `colorTokens` accepts semantic CSS variable names, `themeKey` refreshes custom host tokens, and `errorLabel` customizes the failure message. The host owns data loading, playback timers and pause behavior.

The account demo includes live activity aggregation, task/order trends, date filters, line/bar switching, donut composition, explicit playback, zero/empty states and CSV export. The `overview` slot adds host content below the default account overview, with `{ snapshot, adapter, refresh, appearance }`; the standalone center exposes the same slot without `appearance`.

## Configuration

- Default language: `zh-CN`. Built-in `en-US` and typed partial `messages` overrides apply to all library components, validation and accessibility labels. Existing built-in field validation errors update when the locale or messages change. Host adapter errors, user content and custom slots are translated by the host.
- Configure locale and dates on `NovaAccount` or `NovaTheme`, or call `provideNovaLocale(() => options)` in component setup. No global locale singleton or vue-i18n dependency is required.
- `timeZone` defaults to UTC for deterministic SSR. Use `dateTimeOptions` for Intl options or `formatTime` for a host formatter; server and client must use matching settings.
- `page` / `update:page` provide controlled navigation; `initialPage` initializes uncontrolled mode. `pageChange` reports committed changes. External prop changes are authoritative and preserve built-in profile/preference drafts. Save or explicit discard resets the corresponding draft. Refresh preserves unsaved drafts; replacing the adapter clears them. Implement host router leave guards for unmounts.
- `layout` defaults to `full`; `embedded` retains header / footer and uses natural page height. Standalone components should be placed inside `NovaTheme`.
- `NovaField` supports input / textarea, native input attributes, `maxlength`, descriptions and prefix / suffix slots. Code length defaults to 6 and is configurable through `codeLength`; `null` removes the limit.
- Optional `passwordStrength(password)` returns `{ score: 0..4, label, hint? }` for new-password presentation. It does not enforce password policy or block submission.
- `useAccount().requestResult(operation)` distinguishes `success`, `busy`, `cancelled` and `error`; the original `request()` API retains its `T | undefined` behavior. No automatic replay is performed.

## Host responsibilities

Provide real adapters and runtime response validation. Replace `captcha` and `security` slots with the host's real verification and reauthentication flows. The `simulated` flag is a disclosure switch and does not grant permissions. `initialUser` is display data for a server-verified session, not proof of authentication.

Use `NovaMfaSetup` in the `security` slot with the optional `account.mfa` adapter. It displays the host-issued authenticator setup key, optional QR code and recovery codes. `NovaRecoveryCodes` is also available independently. [Enrollment contract and example](docs/contracts.md#验证器设置与恢复码)

The host must handle authorization, CSRF, password policy and storage, rate limiting, email delivery, session revocation, revision conflicts and unknown outcomes. Aborting a request only suppresses stale UI updates; it does not undo server work. Request IDs are correlation IDs, not durable idempotency keys. Only appearance settings may optionally use localStorage; credentials and account data are never persisted by the library.

See [contracts](docs/contracts.md), [fetch adapter skeleton](docs/adapter.md), [production checklist](docs/production-checklist.md), [Nuxt integration](docs/nuxt.md), [changelog](CHANGELOG.md) and [QA evidence](QA.md). Visual screenshot artifacts and axe scans do not constitute screen-reader, real-device or production-backend acceptance.

### Host feature selection

`NovaAccount` forwards `identifier`, `modes`, `pages`, and `twoStep` to its standalone components:

- `identifier="username"` trims the account name without changing case and keeps the adapter wire field named `email`. Email mode retains lowercase normalization. Runtime identifier changes cancel the old flow and clear credentials. `useAuthFlow` accepts a ref or getter as well as a literal identifier.
- `modes` limits the password, code, register, and reset flows. If password is unavailable initially, the first supplied mode is selected. Removing the active flow cancels it and selects the first remaining mode. Back-to-login uses an available login flow; exposed `setMode` rejects disabled flows. An empty list hides the built-in form while keeping the footer slot.
- `pages` limits sidebar entries, overview shortcuts, and rendered pages. Invalid initial/current pages fall back to the first visible page in the component's canonical navigation order. An empty list renders no account page. Controlled fallback does not emit `update:page`; `pageChange` reports actual displayed page changes. Runtime removal is an authoritative host navigation; hidden drafts survive until save, explicit discard, adapter replacement or unmount.
- `twoStep` defaults to `true`. Setting it to `false` removes the built-in action and cancels/closes its current dialog.

These are presentation options, not server authorization. Aborting an operation does not prove server rollback.

### Integrated demo controls

Consumer-facing account and business pages keep implementation notes in [Workspace guide](docs/demo-workspaces.md). The authentication brand stays at the upper left; profile and notification drafts keep their save/discard guards.

Sign in or register to enter the account. Runtime settings and integration controls live in the account sidebar; their entries remain available when business pages are trimmed or simulated requests fail. Return to sign-in to try the configured flow. Authentication pages contain only the form, verification and feedback needed to proceed. Test credentials are documented in [Demo accounts and flows](docs/demo-credentials.md), without inline credential hints or fill shortcuts. Theme controls appear after sign-in.

The `NovaAuthForm` footer and `NovaAccount` authFooter slots receive `{ mode, resetStage, busy, fill }`. Reset stages are `verify` and `password`; filling fields does not issue or verify a code. The account page slot also exposes `setAppearance` and `storageError` for host-owned integration tools. No sample credentials enter the library bundle.

## Style isolation

The distributed CSS is precompiled and self-contained. Import `nova-account/style.css` explicitly; consumers do not need Tailwind.

- Utilities use the `na:` prefix. Tailwind Preflight and document-wide resets are excluded.
- Theme defaults and generated initialization rules are scoped to `.nova-account`; internal Tailwind properties use `--na-tw-*` and layers use `nova-*` names.
- Override `--na-*` tokens on your own component root. Separate roots can have independent modes and accents. Native dialogs remain inside the themed subtree.
- The 26 accents mirror django-nova-admin: neutral light surfaces and accent-tinted dark surfaces. `violet` replaces the earlier `iris` accent; invalid stored values fall back safely.
- Host global styles, especially `!important`, can still override component styles. This is not Shadow DOM isolation.

## Exports and contracts

| Category             | Exports                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and theme      | `NovaAccount`, `NovaTheme`                                                                                                                                    |
| Account presentation | `NovaAuthForm`, `NovaAccountCenter`, `NovaAppearance`, `NovaCaptcha`                                                                                          |
| Base components      | `NovaButton`, `NovaField`, `NovaDialog`, `NovaIcon`, `NOVA_ICON_NAMES`                                                                                        |
| Reactive flows       | `useAuthFlow`, `useAccount`, `useAppearance`, `parseAppearance`                                                                                               |
| Localization         | `provideNovaLocale`, `useNovaLocale`, `zhCN`, `enUS`                                                                                                          |
| Errors and outcomes  | `NovaError`, `NOVA_ERROR_CODES`, types `NovaErrorCode`, `NovaRequestResult`                                                                                   |
| Contracts            | `NovaAdapter`, `AuthAdapter`, `AccountAdapter`, `RequestContext`, `MutationContext`, `NovaLocaleOptions`, `NovaMessages`, snapshot, user and appearance types |
| Optional chart entry | `nova-account/charts`: `NovaChart`, `NovaChartOption`                                                                                                         |

The `profile` slot replaces the built-in profile page; the host owns its drafts and leave guards. An adapter with `uploadAvatar` enables the built-in avatar uploader. Before reading the file, the component checks image MIME and `avatarMaxBytes` (default 2 MiB); the server must still validate actual content, type and size. Host `id` and `aria-describedby` values are supported by `NovaField`.

## Synthetic demo credentials

| Field               | Value                                      |
| ------------------- | ------------------------------------------ |
| Email               | `demo@demo.com`                            |
| Username mode       | `demo`                                     |
| Sign-in password    | `123456`                                   |
| Email code          | `123456` (or `1234` with four-digit codes) |
| Sample new password | `654321`                                   |
| Sample new email    | `next@demo.com`                            |

All data is synthetic and held in memory; no real email is sent. Registered accounts remain available after sign-out, and password or email changes affect subsequent sign-in until the page is refreshed. Refresh restores the initial data. Code-delivery responses do not expose the code. Only the optional appearance preference is persisted. See [Demo accounts and flows](docs/demo-credentials.md) for registration and security inputs.

## Composable lifecycle and full API

Create `useAuthFlow` and `useAppearance` in component setup or an active `effectScope` (including Pinia setup stores). Components activate browser resources after mount; standalone browser scopes activate immediately. `scope.stop()` / `store.$dispose()` clears timers, removes listeners and cancels pending requests. SSR starts no browser resources. Calls without a scope throw an explicit error. `useAccount` retains manual, unscoped `cancel` / `clear` usage. Do not share stores or adapters across SSR requests.

When stored appearance differs from its initial value, restoration calls `onChange` / emits `update:appearance` once without writing storage. Host prop synchronization stays silent. System appearance changes keep `mode:system` unchanged.

Full shell props: adapter, initialUser, appearance, storageKey, brand, locale/messages/timeZone/dateTimeOptions/formatTime, page/initialPage/pages/extraPages, layout, identifier/modes, twoStep, codeLength, passwordStrength and avatarMaxBytes. Slots: brand, footer, tools, captcha, security, securityFormTools, overview, page, profile and authFooter. The [shared component contracts](docs/contracts.md) specify defaults, scoped slot parameters and host responsibilities; the form has no avatarMaxBytes prop.

The Chinese and English guides both cover development and isolated packaging, optional charts, routing and feature selection, style isolation, exports, avatars and synthetic demo credentials. Detailed API references use the same contract document. The demo additionally includes task editing, comments, orders and base-component workspaces. Real host acceptance still needs email/challenge binding, credential storage, session/CSRF enforcement, rate limiting, device revocation and reconciliation after unknown outcomes. Screen-reader and mobile-keyboard checks remain separate from automated smoke tests.

Chart events are `@ready` when the engine instance is created and `@error` with a string when initialization or drawing fails. These are component events, not module exports. `resolveNovaIcon` is internal; use `NovaIcon` and `NOVA_ICON_NAMES`. Profile avatar identifiers (iris/teal/sun/graphite) are separate from Accent names; the accent rename does not migrate avatar data.

Malformed snapshots are rejected by load/mutate as INVALID_RESPONSE while retaining the last valid snapshot. Hosts still own authorization and business-response validation. Non-string translation overrides fall back to the current built-in dictionary; empty strings remain valid overrides.
