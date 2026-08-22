---
id: dq-regex-interpolates
title: "Double-quoted regex interpolates $vars — and backslash won't save you"
category: args-quoting
versions: "both"
failure: misleading-error
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/3d198e2b80ddb13d02ce63b65e5c88a25b428009
---

# Double-quoted regex interpolates \$vars — and backslash won't save you

## Symptom

A test asserts against a regex like `"SetEnvironmentVariable\(\$entries..."` in a
double-quoted string. Under `Set-StrictMode` it explodes with "variable
'\$entries' cannot be retrieved" — or worse, without StrictMode it silently
matches garbage because \$entries expanded to nothing.

## Repro

```powershell
Set-StrictMode -Version Latest
$text -match "pattern(\$entries -join)"
# ERROR: The variable '$entries' cannot be retrieved because it has not been set.
# The backslash did NOT escape the dollar — \ is not an escape char in PowerShell.
```

## Cause

Two habits from other languages collide: PowerShell interpolates `$var` inside
DOUBLE-quoted strings, and its escape character is the backtick — backslash has
no escaping power. A regex written for .NET/PCRE with `\$` still interpolates.
The variable expands at string-construction time, before the regex engine sees
anything.

## Workaround

- Write regexes that mention `$` in SINGLE quotes: `'pattern(\$entries)'` —
  no interpolation, backslash reaches the regex engine intact.
- If double quotes are unavoidable, escape with backtick: `"\`$entries"`.
