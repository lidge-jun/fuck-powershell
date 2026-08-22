---
name: fuck-powershell
colors:
  primary: "#0a84ff"        # single blue accent (Apple systemBlue dark) — from detail-dark
  accent-semantic: "#ff453a" # red, SEMANTIC ONLY (errors in terminal, failure badges) — from hero-dark
  background-dark: "#0a0a0a" # near-black, never pure #000 — from hero-dark
  background-light: "#f5f5f7" # Apple light canvas — from detail-sidebar
  surface-dark: "#161618"
  surface-light: "#ffffff"
typography:
  heading: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Pretendard Variable', sans-serif", fontSize: "clamp(2.5rem, 8vw, 5.5rem)" }
  body: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Pretendard Variable', sans-serif", fontSize: "1.0625rem" }
  mono: { fontFamily: "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, monospace" }
iconography:
  system: "Phosphor"        # SVG inline; category dock uses colored rounded-square tiles
  weight: "regular"
  domain: "colored-tile"    # macOS app-icon-like rounded squares per category
---

Reading this as: a landing (splash) + docs detail surface for developers, with an
"Apple macOS 27 marketing page" language — dark content-first hero where typography
is the stage, glass strictly on floating chrome, one blue accent plus semantic red.
Reference: devlog/260822_redesign/concepts/*.png (element ledger below).

## Element ledger (synthesis lock)

| Token | Source variant | Rationale |
|---|---|---|
| Hero composition (centered display type + terminal panel) | hero-dark | strongest brand mood; error line = product truth |
| Aurora backdrop | hero-dark, RESTRAINED | max 1 ambient gradient/viewport (FE-GRADIENT-01); opacity <=0.35; no purple |
| Pill nav | hero-light + hero-dark | pill-at-top 76% -> pill-scrolled 90% + blur 14px (FE-LIQUID-STATE-01) |
| Category dock | hero-light | signature moment; 8 colored rounded-square tiles, real SVG glyphs, links to categories |
| Detail layout | detail-sidebar (light) + detail-dark (dark) | Starlight sidebar/toolbar theming; capsule badges |
| Badge chips | detail-dark | versions=blue, failure=amber/red by severity, context=gray capsules |

## Dials

DESIGN_VARIANCE: 6 · MOTION_INTENSITY: 4 · Density: landing D2 / docs D4
Reasoning: marketing-grade splash over a working docs tool; motion = feedback + one
signature (dock hover magnify-lite / headline sheen), scroll-reveal minimal.

## Do / Don't

Do: glass ONLY on nav/toolbar chrome; solid content and code blocks; unified radii
(pill nav 9999px, panels 16px, chips 9999px, tiles 22%); hint of next section in
first viewport; prefers-reduced-motion kills sheen/dock motion.
Don't: glass cards in content; second gradient; purple; emoji icons; oversized text
in docs pages; one-note single-hue wash (aurora stays desaturated navy/steel).

Decision (260822 audit): splash page is dark-only (custom page outside Starlight
layout); docs pages retain Starlight light/dark. All splash links use BASE_URL.
