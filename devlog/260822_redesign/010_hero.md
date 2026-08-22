# 010 — Hero splash (rw2)

## Files

- docs-site/src/pages/index.astro — NEW custom splash (replaces content/docs/index.md
  as landing; Starlight keeps serving /cases/*, /schema/, /skill/).
  - Starlight owns the "/" route via its index docs page → DELETE
    docs-site/src/content/docs/index.md and let src/pages/index.astro take "/".
    (Astro: custom pages win only if the collection page is gone. Verify at build.)
- docs-site/src/styles/landing.css — hero styles (scoped or imported by index.astro).

## Composition (hero-dark lock)

1. body bg #0a0a0a; aurora = ONE radial-gradient pseudo-element, navy/steel
   (oklch desaturated blues), opacity .3, blur 60px, no animation by default.
2. Pill nav: fixed top center, brand glyph + "fuck-powershell" + links (Cases,
   Schema, Skill, GitHub). pill-at-top .76 → .90+blur on scroll (scroll listener
   toggling a class; reduced-motion safe — it is opacity only).
   AUDIT FIX B1: "Cases" points to the on-page dock anchor (#categories) — no
   /cases/ index route exists in Starlight autogenerate. Dock tiles deep-link to
   the first case of each category (verified: all 8 categories have >=1 case).
   AUDIT FIX B2: ALL internal links/assets built from import.meta.env.BASE_URL,
   never hardcoded /fuck-powershell/.
3. Headline: "Where POSIX assumptions explode." clamp(2.75rem,8vw,5.75rem),
   tracking -0.02em, text-wrap balance; sheen = background-clip:text linear white
   gradient, static (no animation; reduced-motion irrelevant).
4. Sub: one line. CTA: "Browse the cases" rounded-rect blue + secondary ghost
   "Install the skill".
5. Terminal panel: solid #161618, radius 16, traffic lights, pwsh tab, the
   ./script.sh NativeCommandError repro with red #ff453a lines (REAL case content
   from curl-alias/dev-null cases — no lorem).
6. Category dock: below terminal, 8 tiles (aliases, args-quoting, streams, encoding,
   exit-codes, versions, env-paths, ci-agents), each a colored rounded-square (22%
   radius) with an inline SVG glyph + label, linking to
   /fuck-powershell/cases/<category>/<first-case>/ or category index anchor.
   Hover: translateY(-4px) scale(1.06), transition transform 150ms; reduced-motion: none.
7. First viewport ends with dock half-visible ("hint of next"), then a short
   "What this is" strip + footer links.

## Design decision (recorded per audit advisory)

The splash is dark-only by design (outside Starlight layout, no theme toggle);
docs pages keep Starlight's light/dark pair. DESIGN.md updated.

## A11y/responsive

- Mobile 390: headline clamps down, dock becomes 4x2 grid, nav collapses to
  brand + menu link (no JS hamburger — anchor to sections).
- Focus-visible rings on all links; skip link to #main; aria-labels on tiles.
- Contrast: white on #0a0a0a passes; blue #0a84ff on dark passes for large text/buttons.
