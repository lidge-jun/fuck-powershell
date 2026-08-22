---
title: fuck-powershell
description: A reproducible-case archive of PowerShell landmines.
---

The places where POSIX assumptions, innocent-looking aliases, and Windows
PowerShell 5.1 legacy behavior quietly (or loudly) destroy cross-platform
scripts, CI pipelines, and coding agents.

Every case is a real failure with a **Symptom / Repro / Cause / Workaround**
writeup and a citation to a public commit, PR, or source file. Browse by
category in the sidebar, or [install the agent skill](/fuck-powershell/skill/)
so your coding agent stops stepping on these.

## Failure modes

- **silent** — data corrupts or failures pass unnoticed. The worst kind.
- **hard-error** — the script dies loudly. Annoying but honest.
- **misleading-error** — an error fires, pointing at entirely the wrong thing.
