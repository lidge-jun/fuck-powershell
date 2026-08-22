# 000 — Design read + steering (aw1)

## Steering (user, mid-P): PRIMARY = Apple-grade UI cleanliness

Not "copy Apple docs anatomy" — make the WHOLE site as clean as Apple UI:
typography rhythm, spacing discipline, hairline borders, quiet chrome, reduced
visual noise. Doc-surface enrichment (At-a-glance card, Cases index) is the
secondary "하는김에" track. Priorities reordered accordingly; concept images
still inform the secondary track.

## Design Read

Reading this as: developer documentation for cross-platform CLI/agent builders,
with an Apple-developer-docs cleanliness language on the existing macOS-27
identity (DESIGN.md tokens stay authoritative).

DESIGN_VARIANCE: 4 · MOTION_INTENSITY: 2 · Density: D4 (docs tool)
Reasoning: docs surface = repeated-use reading tool; cleanliness comes from
restraint, not new visual tricks.

## Cleanliness audit targets (current site defects to fix)

1. Typography rhythm: body line-height/measure not tuned; h2/h3 spacing uneven
   vs Apple's clear 1.6em/section cadence. Fix in theme.css with a rhythm scale.
2. Sidebar noise: 54 case titles are LONG sentences — Apple sidebars are short
   nouns. Fix: sync-cases emits a short "navLabel" (id-derived) via Starlight
   sidebar frontmatter (title stays long in-page).
3. Badge row: chips wrap loosely and sit flush under the h1 — needs tighter
   gap, smaller size, more air before Symptom.
4. Code blocks: default Starlight frame is busy; quiet it (hairline border,
   flatter header, consistent 16px radius) — terminal identity stays.
5. Table styling: bare markdown tables (schema page) lack the Apple
   definition-list feel — hairline row separators, gray label column.
6. Link styling: in-content links underline on hover only; quiet blue.
7. At-a-glance card (secondary): frontmatter-derived summary card on case pages.
8. Cases index (secondary): generated category-card landing page.

## Do / Don't

Do: restraint, hairlines (1px, 8-12% alpha), one accent, generous whitespace,
short nav labels, consistent radii (16 panels / 9999 chips).
Don't: new gradients, glass on content, new fonts, emoji, decorative motion.
