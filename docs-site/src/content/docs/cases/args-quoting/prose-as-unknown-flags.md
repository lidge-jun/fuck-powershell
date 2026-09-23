---
title: "when a CLI reports your prose as unknown flags, PowerShell shredded the argument - not the CLI"
description: "args-quoting landmine — misleading-error (both)"
sidebar:
  label: "prose as unknown flags"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-context">interactive</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#native-argv-rebuild">native-argv-rebuild</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#string-interpolation">string-interpolation</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">UNKNOWN ARGUMENTS</span></div><div class="row"><span class="k">Mechanism</span><span class="v">native argv rebuild, string interpolation</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">file payload</span></span></div></div>

## Symptom

You pass a multi-line document to a CLI as one argument. The receiving tool
reports a *usage error* naming fragments of your prose as if they were flags:

```
gh: unknown arguments ["is" "not" "installed and `EINVAL` reads as bad" "arguments..."]
```

It reads like the CLI mis-parsed its own flags. It didn't. Your single argument
was shredded into many before the CLI was even started, and the pieces that
survive are the ones between your quote characters.

## Repro

```powershell
$body = Get-Content notes.md -Raw    # contains: he said "hello there" to me
gh issue create --title t --body $body
# -> unknown arguments ["hello" "there"]
```

Same shape with `node -e`, where escapes are eaten before Node sees them:

```powershell
node -e "const s='a';console.log(s.split(/\r?\n/).length)"
# SyntaxError: Invalid regular expression: missing /
# — the \r\n became a REAL newline inside the -e string
```

## Cause

PowerShell rebuilds a command line for native processes and re-quotes by
heuristic. Embedded double quotes are consumed as delimiters rather than passed
through, so one argument becomes N. Escape sequences inside a double-quoted
PowerShell string are expanded by PowerShell first, so what the child receives is
not what you typed.

The tell is that the error names *your content* as arguments. Any time a CLI
complains about words from your prose, stop debugging the CLI.

## Workaround

- Never inline prose or code as an argument. Use the file-based flag every good
  CLI provides: `gh issue create --body-file notes.md`, `git commit -F msg.txt`.
- For `node -e`, put the script in a `.mjs` file and run it. Escape sequences in
  a here-string or a file are safe; escape sequences in `-e "..."` are not.
- On 7.2+, `$PSNativeCommandArgumentPassing = 'Standard'` fixes the argument
  vector, but it does nothing for the `-e` case, which is PowerShell's own string
  parsing.

---

`oss-native-arg-quoting` documents the mechanism (quotes stripped, empty args
dropped). This entry is the *diagnostic*: what the failure looks like from the
outside, and why the error message points at the wrong program. That framing is
what an agent needs, because the visible symptom is a CLI usage error rather than
anything resembling a quoting problem.

## Real-world hit

Filing the first issue in this repository failed exactly this way — `gh issue
create --body "$text"` shredded the markdown into flags. Switching to
`--body-file` fixed it.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/4>
