# Changelog

## Unreleased

### Added

- Optional `nova-account/charts` entry with `NovaChart` / `NovaChartOption`, modular Apache ECharts 6.1.0, scoped theme tokens, resize handling, reduced motion, SVG rendering and lifecycle cleanup. The base account entry does not import the chart engine. The account-integrated demo adds activity aggregation, task/order filters, playback, composition charts, readable tables and CSV export.
- Public Lucide-backed `NovaIcon` / `NOVA_ICON_NAMES`, an account-integrated searchable gallery and locally bundled third-party notices. Navigation and action icons use the backend's 2px Lucide stroke convention.
- Typed host `extraPages` / `page` and `overview` slots. Full-screen demo pages reflow into content-specific workspaces with bounded detail panes, aligned forms, a device session list and compact action examples.

- Built-in profile page avatar upload: `Profile.avatarUrl?` plus an optional `AccountAdapter.uploadAvatar({ dataUrl | null }, context)` capability. When implemented, the profile page renders an uploader (file → data URL, busy state, removal) and the avatar image shows on the profile and overview cards; type/size validation and storage stay with the adapter/server. Added a `#profile` slot on `NovaAccountCenter` / `NovaAccount` that replaces the whole profile page (props like `#security`; unsaved-guard ownership moves to the host). The demo adapter implements `uploadAvatar` (image-only, ≤ 2 MB, in-memory) and its host panel swaps in a richer profile editor — job, phone, birthday, gender, website, tag picker — through the slot.
- Full accent alignment with the django-nova-admin palette scheme: 26 options, `blue` carrying the admin default scheme plus the 25 industry presets (医疗青 / 专业靛 / 文教紫 / 零售陶 / 石墨黑 / 午夜蓝 / 松林绿 / 暖琥珀 / 深海青 / 雾岩灰 / 暮梅紫 / 摩卡棕 / 冰川蓝 / 胭脂红 / 苔原绿 / 极夜黑 / 朱砂红 / 鎏金黄 / 翡翠绿 / 孔雀蓝 / 霞光紫 / 工业橙 / 兰花紫 / 终端绿 / 宣纸黄). Relative to earlier dev builds `iris` is replaced by `violet` and `blue` now means the admin default blue; stored appearance values with removed names fail whitelist validation and fall back to the default safely. The 4.5:1 contrast gates cover all 52 mode/accent combinations; blue dark soft is darkened to `#142842` because this library renders muted text on soft containers.
- MIT license, English README, fetch adapter skeleton and host production checklist.
- Node 22.12 / 24 library CI, Nuxt 3 / 4 tarball CI, Chromium / Firefox / WebKit smoke and axe scans.
- ESLint / Prettier checks, V8 coverage thresholds and gzip budgets for shipped JS / CSS.
- Per-root `locale`, typed `messages`, `timeZone`, `dateTimeOptions`, and `formatTime` configuration through `NovaTheme` / `NovaAccount`; Chinese remains the default, English is included.
- `page` / `update:page`, `initialPage`, and `layout="embedded"` for host routing and composition.
- Textarea / affix slots / `maxlength` in `NovaField`, configurable auth code length, and optional host password-strength presentation.
- Typed `NOVA_ERROR_CODES` / `NovaErrorCode` and `useAccount().requestResult()` for success, busy, cancellation and error outcomes.
- Forwarded `authFooter` slot on `NovaAccount` to replace the auth card footer (for example host-provided SSO placeholders); the default simulated disclosure remains when the slot is unused.
- Standalone demo coverage for the host integration surface: a "宿主集成演示" tools panel with embedded/full layout switch, controlled `page` jumps with a `pageChange` log, a TOTP-style `#security` slot demo, host `passwordStrength`, `codeLength` with a matching demo code, and a localStorage fault that surfaces `storageError`; the mock auth adapter can also serve a math challenge through the `#captcha` slot, the demo can expire the session (next account request reports 401 and the host clears the local session), simulate an external edit that yields `REVISION_CONFLICT`, throttle send-code requests after the first success, render SSO placeholder buttons via `#authFooter`, confirm a demo account deletion through a danger-zone dialog, show two independently themed `NovaTheme` roots side by side, and open the demo in a real narrow-viewport window for responsive checks.
- Added an always-visible light/dark quick toggle in the demo shell header through the `#tools` slot: it resolves `mode: 'system'` to the current effective mode before flipping, preserves the accent, and persists through the existing storage key; the full appearance settings stay in the tools panel. Hosts can copy the pattern verbatim.
- Extended "宿主集成演示" capability coverage: `identifier` username mode (demo account `demo`, demo auto-fill follows the mode), `modes` login-flow trimming with documented fallback, `pages` account-page trimming, a `twoStep` toggle, `initialUser` session restore via shell remount (display input only, no authenticated event), typed `messages` overrides and a `brand` prop, controlled `appearance` with host-held state, a `storageKey` persistence switch that re-initializes the shell, a unified typed-event log (authenticated / logout / pageChange / update:page / update:appearance, newest first), and a standalone "基础组件形态" panel showing `NovaField` affix slots, textarea, `maxlength`, disabled/error states and `NovaButton` variants.
- Added a standalone "业务场景组合" scene gallery view composed purely from the shipped base components: field shapes (affixes, number/tel/password/date inputs, textarea with UTF-16 count, error and disabled states), a task list with search, status filter, completion and empty state, a lightweight editor with maxlength, character hint, preview and busy save, a comment thread with validation, publish and like toggles, and an order list with status filters, a themed detail dialog and simulated payment; all data is synthetic and in-memory, and none of these cards ship in the npm package.

### Changed

- Demo configuration now lives in the account sidebar under “演示设置” and “组件接入”; the header tools dialog and duplicate entries are removed. Login, registration and password reset show mode-specific sample credentials with inline fill actions. Typed `authFooter` / `footer` slot props expose the current mode, reset stage, busy state and fill callback; the account `page` slot also exposes `setAppearance` and `storageError`.
- Dark mode switches the whole tinted surface set per accent (canvas, sidebar, surface, ink, muted, line, control), taken from each django-nova-admin palette's dark surfaces, instead of only swapping brand and soft. Light mode keeps neutral surfaces with a brand-only swap, matching the admin preview.
- Dates use `Intl.DateTimeFormat`; default zone remains UTC for deterministic SSR. Display is localized instead of appending a literal UTC suffix. Set a zone explicitly for local time.
- Appearance choices use native radio inputs. Consumers targeting old button / `aria-pressed` selectors must update them; `update:modelValue` is unchanged.
- Auth codes default to `maxlength=6`; use `codeLength` for another service policy or `null` to omit the presentation limit.
- Profile nickname / bio inputs now have 24 / 120 UTF-16 code-unit limits. Server-side validation remains authoritative.
- Countdown timers pause while the document is hidden and refresh when it becomes visible.

### Fixed

- Avatar reads, uploads and removals now use the account request controller: adapter changes, navigation and unmount cancel old operations, stale results cannot replace another account, and profile saves cannot race avatar updates.

- Embedded demo grid tracks shrink to the host width instead of inheriting signed-in content minimum widths; added 320px / 390px regressions for profile editing and all seven account pages after switching host layout.

- Multi-instance demo grid columns can shrink below 320px inside narrow hosts; forms remain visible without clipping while wider screens retain side-by-side instances. Browser regressions cover 320px / 390px full layouts, 320px embedded layout, and an 820px two-column layout.

- Host `modes` now selects and preserves only allowed auth flows, cancels removed in-flight flows, handles code-only return navigation and an empty mode list, and retains a valid form accessible name with one login mode.
- Username identifiers preserve case across adapter calls; changing identifier semantics updates validation and cancels stale verification state. Auth tabs use absolute Home/End navigation.
- Account `pages` restrictions apply to overview shortcuts and selected pages as well as the sidebar, with safe initial/reactive fallback and no controlled-page update echo.
- Standalone account centers retain the intended enabled-by-default two-step control; disabling it closes/cancels its dialog and ignores late results.
- Switching the demo into multi-instance view preserves the primary session, page, and unsaved draft. The small popup preview requests its advertised 320×568 dimensions.

- Message action names now include their visible content, preserving read state and satisfying the axe label-in-name check.
- Navigating before the first account snapshot finishes loading no longer cancels the shared load and leaves an empty page.
- Existing built-in field validation errors follow locale and message override changes without resubmission or clearing input.
- Failed auth submissions focus the first invalid field, or the global error summary when the adapter rejects a submission without field errors. Language changes do not move focus.
- Demo viewport metadata no longer uses `interactive-widget`, which produces a console error in Linux WebKit and failed the browser CI job. Responsive layout and `viewport-fit=cover` remain in place; real soft-keyboard acceptance is still pending.

### Compatibility and release policy

Existing adapter methods, default full layout, Chinese UI and `request()` return values are preserved. `request()` / `load()` / `mutate()` still return `undefined` on ignored, cancelled or failed work; use `requestResult()` when those states must be distinguished.

The repository remains `0.1.0-dev.1`, private and unpublished. During `0.x`, record incompatible changes here and increment the minor version before publishing one; use patch releases for compatible fixes, and prerelease suffixes for development builds. Every release must run the documented checks and explicitly list remaining host acceptance work.

## 0.1.0-dev.2 — 2026-11-05

### Added

- `identifier: 'email' | 'username'` on `NovaAuthForm` / `NovaAccount` (default `email`). Username mode switches the account field to text input with `autocomplete="username"`, the `auth.account` label, and a non-empty / ≤150 / whitespace-free validation; the adapter contract is unchanged and receives the value in `email`.
- `modes: AuthMode[]` on `NovaAuthForm` / `NovaAccount` (default all four). Hidden flows never render their entries: a single login tab removes the tablist, and register / reset entries disappear accordingly.
- `pages: AccountPage[]` on `NovaAccountCenter` / `NovaAccount` (default all seven) to restrict visible account pages, and `twoStep: boolean` (default `true`) to hide the security-page two-step row when the host has no step-up implementation.

## 0.1.0-dev.1 — 2026-10-27

- Initial Vue 3 presentation library, injected adapters, isolated CSS, offline demo, strict package consumer checks, and Nuxt SSR examples.
