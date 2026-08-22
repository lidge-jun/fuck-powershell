---
id: localized-cli-output-parsing
title: "parsing schtasks or sc output works until the machine is not English, because Windows tools translate their column headings and status words"
category: parsing
versions: "both"
failure: silent
context: [script, agent, ci]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/34
  - https://github.com/lidge-jun/opencodex/commit/1d9e196e7
  - https://github.com/lidge-jun/opencodex/commit/cdc16e5a7
  - https://github.com/lidge-jun/opencodex/commit/438b8dcf4
ontology:
  affects: [env-windows, shell-cmd, env-korean-codepage]
  invokes: [command-schtasks]
  caused_by: [mechanism-localized-output]
  mitigated_by: [workaround-structured-output-not-text]
---

# parsing schtasks or sc output works until the machine is not English, because Windows tools translate their column headings and status words

## Symptom

A status check that reads a built-in Windows tool's output reports the wrong
thing on a machine whose system language is not English. The service is
installed and your code says it is not; the task is running and your code decides
it is stale and reinstalls it — writing the same definition that failed the same
comparison, so the loop never terminates.

Nothing throws. Text was searched for a substring, the substring was not there,
and the absence was read as a fact about the system.

## Repro

On an English machine:

```
C:\> schtasks /Query /TN MyTask /FO LIST
TaskName:      \MyTask
Status:        Ready
```

On a Korean one, same task, same command:

```
C:\> schtasks /Query /TN MyTask /FO LIST
작업 이름:     \MyTask
상태:          준비
```

So the check inverts:

```js
out.includes("Ready")        // true on en-US, false everywhere else
out.includes("Running")      // same
```

`sc query`, `net`, `tasklist`, and `icacls` all localize the same way, and their
error text localizes too — so error CLASSIFICATION by message matching fails in
the same places.

## Cause

Windows built-in command-line tools are localized: the headings, the state words,
and the error messages are all translated to the system UI language. Only the
structure and the exit code are stable.

That makes any `includes("Ready")` a test of the machine's language rather than
of its state, and English is the one language where the bug is invisible.

There is a second, subtler version of this that survives translation: encoding
round-trips. Task Scheduler exports task XML with its own entity encoding, so a
needle you escaped yourself (`&quot;`) never matches the literal `"` the export
contains. Same failure shape — two spellings of one value compared as strings —
and it is permanent rather than locale-dependent.

## Workaround

Ask for structured output and parse the structure, not the prose:

```
schtasks /Query /TN MyTask /XML        # XML, element names are not translated
sc.exe query MyService                 # exit code 1060 = does not exist
Get-ScheduledTask -TaskName MyTask     # PowerShell objects, typed .State enum
```

Prefer, in order: an exit code, a typed object from a PowerShell cmdlet, XML or
JSON element names, and only then text. When you must compare XML values, decode
entities on both sides exactly once before comparing — and decode once, not
repeatedly, so `&amp;quot;` cannot impersonate a quote.

For liveness, do not parse a tool's opinion at all: check the thing itself. An
identity-verified probe of your own process answers the real question and is
immune to every translation.

Keep localized text out of user-facing output too. Echoing a decoded-wrong,
locale-specific line back to a user turns one bug into two.

---

`env-domain-principal` is the identity version of this mistake: trusting an
environment-derived string instead of resolving the real principal. This is the
output version — trusting a tool's prose instead of its structure.
