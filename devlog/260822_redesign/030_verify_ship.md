# 030 — Verify + ship (rw4)

1. bun run build exit 0 (receipt).
2. bunx astro preview (managed session) → screenshot with headless Chrome:
   - hero desktop 1440x900, hero mobile 390x844
   - one detail page (curl-alias) light + dark, desktop
   Tool: agbrowse screenshot or chrome --headless --screenshot; store under
   devlog/260822_redesign/verify/.
3. view_image audit each screenshot against DESIGN.md Do/Don't (glass budget,
   accent discipline, no emoji, dock rendering, badges as capsules, mobile grid).
4. Fix deltas, re-shoot changed states only.
5. Commit, push origin main (authorized), gh run watch → success, curl live 200.
6. Close criteria rc2-rc5 with evidence paths.
