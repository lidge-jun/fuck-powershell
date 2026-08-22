# 040 — Site ontology surfacing + frontend bugfix (ow5)

1. sync-cases.mjs: badge table gains mechanism/error chips linking to ontology
   pages, parsed via the SHARED nested-frontmatter parser imported from
   build-graph (audit B3) — no second parser implementation.
2. New generated docs: docs-site prebuild script sync-ontology.mjs emits
   src/content/docs/ontology/index.md (overview + stats), mechanisms.md
   (per-mechanism: definition + case list), errors.md (signature reverse
   index). Sidebar: new "Ontology" group before Cases.
3. Sidebar overflow mitigation (54 cases, audit #6): collapse case groups by
   default (Starlight collapsed: true per category group) and keep Ontology
   group (index/mechanisms/errors) above Cases.
4. Frontend audit (cxc-dev-frontend visual verification): screenshot hero +
   case page + ontology page desktop/mobile; known suspects: long case titles
   overflow in sidebar (54 cases now), badge row wrap on mobile, dock links
   to first-case only (fine), search index size. Fix what audit finds, verify
   with re-shots.
Receipt: build exit 0 + screenshots inspected.
