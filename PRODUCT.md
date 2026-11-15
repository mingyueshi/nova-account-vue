# Nova Account demo

## Register

product

## Users

People trying a consumer account experience, with developers using the same account navigation to evaluate components and integration patterns.

## Product Purpose

Provide an interactive, standalone demonstration of authentication, account settings, base components and host-owned business compositions. The demo uses in-memory adapters and is separate from the published library.

## Brand Personality

Clear, restrained and practical. Preserve the existing Nova typography, theme tokens and component vocabulary.

## Anti-references

Avoid presenting mock flows as real authentication or payment, and avoid burying core examples inside configuration dialogs.

## Design Principles

- Integrate business scenes and base component examples into the account sidebar and content area; do not create separate top-level demo pages.
- Use the library's actual components in interactive examples.
- Preserve mock scene state between account pages; reuse the account unsaved-change guard for profile and preference drafts.
- Keep runtime and integration controls inside the account navigation; remove the separate tools dialog. Keep configuration reachable during simulated request failures and page trimming. Present authentication as a consumer-facing product flow. Keep sample accounts, passwords, codes and technical explanations in documentation only; do not add preview bypasses or credential-filling controls to authentication pages.
- Keep consumer account pages focused on personal information, security, notifications, messages and business actions. Put mock-data limits and component implementation notes in documentation; preserve useful state, validation, save feedback and confirmation. Anchor the site brand at the upper left on authentication pages.
- Full-screen pages reflow into useful workspaces: grouped forms, list/detail panes, editing/preview pairs and responsive component inspectors. Do not simply stretch single-column content. Use the actual account content width for layout decisions.
- Align default surfaces, semantic chart colors and 2px Lucide strokes with django-nova-admin; keep all 25 authored palette overrides aligned.
- Integrate optional ECharts into account activity and a business data workspace; use one dataset for charts, summaries and exports, with explicit playback and readable tables.
- Use the locally bundled open-source Lucide icons consistently, with an account-integrated searchable icon gallery and reusable NovaIcon API.

- On phones, use readable native text controls, keep modal actions reachable while content scrolls, account for bottom safe areas, and preserve drafts and useful focus through validation, save and cancel flows.
- Mobile account navigation uses a grouped bottom sheet with a clear current page, independent scrolling and a separate sign-out action. Close it before opening an unsaved-change guard. Keep clean forms unobstructed; make save actions prominent when there are edits.

## Accessibility & Inclusion

Preserve the existing keyboard, semantic form, responsive layout and accessible-dialog patterns. Support narrow viewports and reduced motion. Automated accessibility checks complement browser verification.
