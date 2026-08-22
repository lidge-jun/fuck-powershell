---
title: Install the skill
description: An installable agent skill distilled from the archive.
---

The repo ships `skills/powershell-landmines/` — a distilled skill for
Codex/Claude-style agents: a 10-rule pre-flight checklist plus per-category
reference files generated from the case archive.

## With skill-installer

```
scripts/install-skill-from-github.py --repo lidge-jun/fuck-powershell --path skills/powershell-landmines
```

## Manually

Copy `skills/powershell-landmines/` into your agent's skills directory
(e.g. `~/.codex/skills/`). The folder name becomes the skill name.

## Regenerating

`references/` is generated from `cases/` by `bun scripts/build-skill.mjs`.
Edit cases, not references.
