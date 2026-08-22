---
title: "The English word 'and' is not a statement separator"
description: "args-quoting landmine — misleading-error (both)"
sidebar:
  label: "'and' is not a separator"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">interactive</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#prose-as-argument">prose-as-argument</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">PARAMETERBINDING</span></div><div class="row"><span class="k">Mechanism</span><span class="v">prose as argument</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">semicolon separator</span></span></div></div>

## Symptom

A user (or an agent-generated recovery message) pastes a line like
"remove the variable and set the new one" written as actual commands joined by
the word `and` — and PowerShell throws a baffling parameter-binding error on
the FIRST command, or silently binds `and` as an argument.

## Repro

```powershell
Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue and $env:CODEX_HOME = "C:\new"
# 'and' plus everything after it binds into Remove-Item's argument list —
# one broken statement, not two commands.
```

## Cause

PowerShell has `-and` as a boolean operator inside expressions, but bare `and`
between commands is just another positional argument. Prose-style command
chaining parses as one statement. Documentation and agent prompts that render
"do X and do Y" as a single line produce copy-paste traps.

## Workaround

- Separate statements with `;` (unconditional) or check `$?`/use `if` for
  conditional chaining (5.1 has no `&&`).
- The referenced fix changed a shipped recovery one-liner from "... and ..." to
  "...; ..." exactly because users pasted it verbatim.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/a00f1a4618c683e173af1e17ee06e4a25e0434a1>
