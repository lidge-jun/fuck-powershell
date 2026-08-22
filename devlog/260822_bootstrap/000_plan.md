# 000 — Bootstrap Plan (wp1 docs-only roadmap cycle)

Goal: publish public repo lidge-jun/fuck-powershell — a reproducible-case archive of
PowerShell landmines + installable Codex/Claude skill + Astro Starlight docs site on
GitHub Pages.

## This cycle (wp1) deliverables — docs only

- 001_research.md — case schema (final), first-party case inventory (from opencodex /
  cli-jaw devlogs with file pointers), third-party mining strategy + verified commit
  candidates from Luna swarm.
- 010_scaffold.md — repo skeleton diff-level spec (cases/, scripts/lint-cases.mjs,
  README, LICENSE, .gitignore).
- 020_seed_cases.md — per-case outline: 4+ first-party + 2+ third-party (commit URLs).
- 030_skill.md — skills/powershell-landmines spec (SKILL.md frontmatter, references/
  layout, install one-liner).
- 040_docs_site.md — Starlight config spec (content collection from cases/, sidebar by
  category, deploy.yml for Pages).
- 050_publish.md — gh repo create/push/verify procedure, Pages enablement.

## Case schema (locked this cycle)

frontmatter: id, title, category (aliases|args-quoting|streams|encoding|exit-codes|
versions|env-paths|ci-agents), versions (5.1|7.x|both), failure (silent|hard-error|
misleading-error), context ([interactive|script|ci|agent]), refs (URLs).
body: Symptom / Repro / Cause / Workaround / Refs.

## Later cycles

wp2 = 010+020 implementation, wp3 = 030+040, wp4 = 050. One decade doc set per cycle P
re-verifies before build.

## Out of scope

No edits to opencodex/cli-jaw. No parent-repo commits. Mass OSS analysis is a follow-up
goal; this repo only seeds the pipeline with 2+ mined cases.
