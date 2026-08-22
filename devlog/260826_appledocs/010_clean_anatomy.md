# 010 — Apple-grade cleanliness + case anatomy (aw2)

PRIMARY (cleanliness, theme.css + sync-cases):
1. Typography rhythm: --sl-text scale tune; content h2 margin-top 2.2em/bottom
   0.7em; body line-height 1.7; measure ~70ch; paragraph spacing 1.1em.
2. Short nav labels: sync-cases writes sidebar: {label} = title-cased id words
   (e.g. "spawn-npm-enoent-einval" → "npm spawn ENOENT/EINVAL"? NO — mechanical:
   id → space-joined, keep upper tokens like ENOENT if present in id) via
   Starlight frontmatter sidebar.label. Manual override map for the worst 10.
3. Badge row: font-size .74rem, gap .4rem, margin-bottom 2rem.
4. Code frame: flatten .sl-markdown-content pre header; hairline border only.
5. Tables: hairline row separators, first-column gray, no zebra.
6. Links: quiet blue, underline on hover.

SECONDARY (anatomy, sync-cases):
7. Eyebrow: "<CATEGORY> · CASE" div above title (inside body since Starlight
   owns h1 — emit as first body element styled as eyebrow).
8. At-a-glance card after badges: definition rows from frontmatter+ontology
   (Affects = affects labels; Fails as = manifests_as or failure; Mechanism =
   caused_by labels; Safe fix = first mitigated_by label). Solid panel per ledger.
   Rendered as contiguous HTML like badges (remark rule).
