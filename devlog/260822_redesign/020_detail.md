# 020 — Detail theming (rw3)

## Files

- docs-site/src/styles/theme.css — Starlight custom props override, imported via
  starlight config customCss.
- scripts/sync-cases.mjs — replace markdown badge TABLE with an HTML capsule row
  (raw HTML in markdown is fine for Starlight): <div class="case-badges">
  <span class="badge badge-version">5.1</span> ... with failure-severity classes
  (silent=amber, hard-error=red, misleading-error=orange), context gray, source/repro gray.
- docs-site/astro.config.mjs — add customCss entry.

## Tokens (both themes)

- Light: --sl-color-bg #f5f5f7, content surface #fff, sidebar #f5f5f7 solid,
  toolbar frosted (rgba 255 .82 + blur 14px), text #1d1d1f, accent #0a84ff.
- Dark: --sl-color-bg #0a0a0a, surface #161618, sidebar solid #111113, toolbar
  frosted (rgba 10 .78 + blur 14px), text #f5f5f7, accent #0a84ff.
- Radii: panels/code 16px (--fp-radius), chips 9999px. Code blocks SOLID dark in
  both themes (terminal identity), red error tokens preserved.
- Glass budget: toolbar ONLY. Sidebar, cards, content = solid (FE-LIQUID-LAYER-01).
- Starlight selectors (verified against installed 0.41.7 source by auditor):
  header = header.header (frost), sidebar = .sidebar-pane (solid — keep solid bg on
  the mobile [aria-expanded='true'] variant too), content = .sl-markdown-content.
- Atomicity: theme.css + sync-cases.mjs badge change + astro.config customCss land
  in ONE commit (unstyled-badge window banned).
- Badge HTML: one contiguous block, no blank lines inside (remark raw-HTML rule).

## Out of scope here

No sidebar icon-tile system this round (Starlight autogenerate labels only) — logged
as follow-up; keeps this phase small and testable.
