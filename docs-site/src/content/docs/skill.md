---
title: Install the skill
description: An installable agent skill distilled from the archive.
---

The repo ships `skills/powershell-landmines/` — a query-first skill for
Codex/Claude-style agents backed by the landmine graph.

## Getting started

1. **Pull the corpus** — `git clone https://github.com/lidge-jun/fuck-powershell ~/.fuck-powershell`
2. **Preflight before patching** — `bun ~/.fuck-powershell/scripts/fp.mjs preflight --runtime node --operation spawn --target npm`
3. **Read the top cases** — `bun ~/.fuck-powershell/scripts/fp.mjs case spawn-npm-enoent-einval`
4. **Patch with the constraints applied.**
5. **Postflight the diff** — `fp search "<risky tokens>"`, `fp errors einval`.

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
