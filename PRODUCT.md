# Nova Account demo

## Register

product

## Users

Vue developers evaluating the account components and trying host integration patterns.

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
- Keep integration controls available without dominating the examples.
- Full-screen pages reflow into useful workspaces: grouped forms, list/detail panes, editing/preview pairs and responsive component inspectors. Do not simply stretch single-column content. Use the actual account content width for layout decisions.
- Align default surfaces, semantic chart colors and 2px Lucide strokes with django-nova-admin; keep all 25 authored palette overrides aligned.
- Integrate optional ECharts into account activity and a business data workspace; use one dataset for charts, summaries and exports, with explicit playback and readable tables.
- Use the locally bundled open-source Lucide icons consistently, with an account-integrated searchable icon gallery and reusable NovaIcon API.

## Accessibility & Inclusion

Preserve the existing keyboard, semantic form, responsive layout and accessible-dialog patterns. Support narrow viewports and reduced motion. Automated accessibility checks complement browser verification.
