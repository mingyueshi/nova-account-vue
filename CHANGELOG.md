# Changelog

## Unreleased

### Added

- MIT license, English README, fetch adapter skeleton and host production checklist.
- Node 22.12 / 24 library CI, Nuxt 3 / 4 tarball CI, Chromium / Firefox / WebKit smoke and axe scans.
- ESLint / Prettier checks, V8 coverage thresholds and gzip budgets for shipped JS / CSS.
- Per-root `locale`, typed `messages`, `timeZone`, `dateTimeOptions`, and `formatTime` configuration through `NovaTheme` / `NovaAccount`; Chinese remains the default, English is included.
- `page` / `update:page`, `initialPage`, and `layout="embedded"` for host routing and composition.
- Textarea / affix slots / `maxlength` in `NovaField`, configurable auth code length, and optional host password-strength presentation.
- Typed `NOVA_ERROR_CODES` / `NovaErrorCode` and `useAccount().requestResult()` for success, busy, cancellation and error outcomes.
- Forwarded `authFooter` slot on `NovaAccount` to replace the auth card footer (for example host-provided SSO placeholders); the default simulated disclosure remains when the slot is unused.
- Standalone demo coverage for the host integration surface: a "宿主集成演示" tools panel with embedded/full layout switch, controlled `page` jumps with a `pageChange` log, a TOTP-style `#security` slot demo, host `passwordStrength`, `codeLength` with a matching demo code, and a localStorage fault that surfaces `storageError`; the mock auth adapter can also serve a math challenge through the `#captcha` slot, the demo can expire the session (next account request reports 401 and the host clears the local session), simulate an external edit that yields `REVISION_CONFLICT`, throttle send-code requests after the first success, render SSO placeholder buttons via `#authFooter`, confirm a demo account deletion through a danger-zone dialog, show two independently themed `NovaTheme` roots side by side, and open the demo in a real narrow-viewport window for responsive checks.

### Changed

- Dates use `Intl.DateTimeFormat`; default zone remains UTC for deterministic SSR. Display is localized instead of appending a literal UTC suffix. Set a zone explicitly for local time.
- Appearance choices use native radio inputs. Consumers targeting old button / `aria-pressed` selectors must update them; `update:modelValue` is unchanged.
- Auth codes default to `maxlength=6`; use `codeLength` for another service policy or `null` to omit the presentation limit.
- Profile nickname / bio inputs now have 24 / 120 UTF-16 code-unit limits. Server-side validation remains authoritative.
- Countdown timers pause while the document is hidden and refresh when it becomes visible.

### Fixed

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
