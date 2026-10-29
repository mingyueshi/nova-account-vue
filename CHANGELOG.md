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

### Changed

- Dates use `Intl.DateTimeFormat`; default zone remains UTC for deterministic SSR. Display is localized instead of appending a literal UTC suffix. Set a zone explicitly for local time.
- Appearance choices use native radio inputs. Consumers targeting old button / `aria-pressed` selectors must update them; `update:modelValue` is unchanged.
- Auth codes default to `maxlength=6`; use `codeLength` for another service policy or `null` to omit the presentation limit.
- Profile nickname / bio inputs now have 24 / 120 UTF-16 code-unit limits. Server-side validation remains authoritative.
- Countdown timers pause while the document is hidden and refresh when it becomes visible.

### Fixed

- Message action names now include their visible content, preserving read state and satisfying the axe label-in-name check.

- Navigating before the first account snapshot finishes loading no longer cancels the shared load and leaves an empty page.

### Compatibility and release policy

Existing adapter methods, default full layout, Chinese UI and `request()` return values are preserved. `request()` / `load()` / `mutate()` still return `undefined` on ignored, cancelled or failed work; use `requestResult()` when those states must be distinguished.

The repository remains `0.1.0-dev.1`, private and unpublished. During `0.x`, record incompatible changes here and increment the minor version before publishing one; use patch releases for compatible fixes, and prerelease suffixes for development builds. Every release must run the documented checks and explicitly list remaining host acceptance work.

## 0.1.0-dev.1 — 2026-10-27

- Initial Vue 3 presentation library, injected adapters, isolated CSS, offline demo, strict package consumer checks, and Nuxt SSR examples.
