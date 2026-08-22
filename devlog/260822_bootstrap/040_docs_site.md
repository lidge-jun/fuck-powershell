# 040 — Docs site + Pages CI (wp3 second half)

docs-site/: Astro Starlight, minimal deps (astro + @astrojs/starlight only; no fonts/
echarts — opencodex docs-site is the pattern, not a copy).
- astro.config.mjs: site https://lidge-jun.github.io, base '/fuck-powershell/' (project
  Pages — missing base 404s every asset; set trailingSlash: 'always'),
  srcDir content from ../cases via symlink? NO — Starlight docs collection requires
  src/content/docs; use a small prebuild script (bun scripts/sync-cases.mjs) that copies
  cases/*.md into docs-site/src/content/docs/cases/<category>/<id>.md and REWRITES
  frontmatter: strip ALL custom keys (category/versions/failure/context/source/repro/
  refs) — Starlight docsSchema rejects unknown keys unless extended — emitting only
  {title, description} and rendering the stripped keys as a badge table at body top.
  Hand-written index.mdx + schema.mdx.
- Sidebar: autogenerate group per category using directory grouping after sync
  (sync writes cases/<category>/<id>.md).
- .github/workflows/deploy.yml: on push main → bun install, bun run build in docs-site,
  actions/deploy-pages@v4 with actions/upload-pages-artifact. permissions: pages write,
  id-token write.
