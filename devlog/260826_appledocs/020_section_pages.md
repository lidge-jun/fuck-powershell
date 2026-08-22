# 020 — Section pages (aw3)

1. Cases index: NEW scripts addition in sync-cases.mjs — generate
   src/content/docs/cases/index.md (title "All cases"): 2-col card grid
   (contiguous HTML), per category: dock-matching SVG glyph + tinted tile,
   name, count badge, description line (hand-written map), case rows (short
   navLabel + chevron) linking to case pages. CSS in theme.css (.case-cards).
   Sidebar: replace #categories dock anchor target? NO — hero dock keeps
   anchors; nav "Cases" in Starlight sidebar gains the index via
   autogenerate picking up cases/index.md automatically as group landing.
2. Schema page: definition-table styling benefits automatically from item 5;
   restructure prose into "Anatomy of a case" with field-by-field definition
   table (hand edit — it is a hand-written page).
3. Skill page: step-numbered getting-started flow (1 clone, 2 preflight,
   3 read case, 4 patch, 5 postflight) using styled ordered list (CSS counter
   circles), keeping existing content.
4. Hero pill nav "Cases" → /cases/ index (replaces #categories anchor — the
   index IS the browse surface now; dock tiles keep deep links).
