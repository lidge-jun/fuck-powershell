---
id: cmd-start-ampersand-splits
title: "cmd /c start truncates your URL at the first &"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd, command-start]
  caused_by: [mechanism-cmd-reparse]
  mitigated_by: [workaround-caret-escape-cmd, workaround-runtime-opener]
---

# cmd /c start truncates your URL at the first &

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
