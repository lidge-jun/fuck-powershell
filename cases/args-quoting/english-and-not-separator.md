---
id: english-and-not-separator
title: "The English word 'and' is not a statement separator"
category: args-quoting
versions: "both"
failure: misleading-error
context: [interactive, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/a00f1a4618c683e173af1e17ee06e4a25e0434a1
---

# The English word 'and' is not a statement separator

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
