---
title: "cmd /c start truncates your URL at the first &"
description: "args-quoting landmine — silent (both)"
sidebar:
  label: "CMD start ampersand splits"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#cmd-reparse">cmd-reparse</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">cmd, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">cmd reparse</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">caret escape cmd</span></span></div></div>

## Symptom

Opening a URL with cmd /c start opens the browser at ...?a=1 — the rest of the
query string vanished, and sometimes 'b' is not recognized as a command flashes.

## Repro

```
cmd /c start "" https://example.com/?a=1&b=2
# browser opens ...?a=1 ; cmd tries to run "b=2" as a second command
```

## Cause

cmd.exe re-parses the command line it is handed; & is its command separator.
URLs routinely contain &, so routing them through cmd /c start splits the line
into two commands at the first ampersand.

## Workaround

- Escape cmd metacharacters (& ^ | < > %) with ^ before interpolating — the
  referenced fix does this for browser-open.
- Better: avoid cmd — spawn rundll32 url.dll,FileProtocolHandler <url> or use
  the runtime's opener API.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8>
