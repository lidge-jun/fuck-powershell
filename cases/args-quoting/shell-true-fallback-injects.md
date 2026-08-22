---
id: shell-true-fallback-injects
title: "the shell:true fallback you added to fix a spawn error turns any user text in argv into a second command"
category: args-quoting
versions: "both"
failure: silent
context: [agent, script, ci]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/8f294b449a99acee7c0e0f7057898008fef9f441
ontology:
  affects: [shell-cmd, env-windows, runtime-node]
  invokes: [command-cmd]
  caused_by: [mechanism-cmd-reparse]
  mitigated_by: [workaround-refuse-shell-on-untrusted-argv]
  unsafe_fix: [workaround-shell-true]
---

# the shell:true fallback you added to fix a spawn error turns any user text in argv into a second command

## Symptom

There is no symptom. That is the case.

Your Windows spawn failed with `ENOENT` or `EINVAL`, you added `shell: true`, it
worked, and you moved on. Everything keeps working. Nothing in a log or a test
says that one argument in that argv is now interpreted rather than passed.

The failure appears the first time a value in argv contains `&`, which for an
agent, a chat CLI, or anything that forwards a user prompt is a matter of time
rather than luck.

## Repro

```js
const { spawnSync } = require("node:child_process");
const userText = "summarize this & calc";

spawnSync("mytool.cmd", ["--prompt", userText], { shell: true, stdio: "inherit" });
// cmd.exe sees:  mytool.cmd --prompt summarize this & calc
// and runs calc.exe as a separate command
```

Without `shell: true` the same argv arrives as one argument. With it, cmd.exe
re-parses the assembled line and `&`, `|`, `<`, `>`, `^`, and `%VAR%` all become
syntax.

## Cause

`shell: true` does not "run the same thing through a shell". It flattens argv into
a single command line and hands that string to `%ComSpec%`, which parses it again
with its own grammar. Node does not escape cmd metacharacters when it does this,
and cannot: it has no way to know which characters you meant as data.

The reason this is such a common wound on Windows specifically is that the two
errors pushing you toward it are both Windows-only. Bare `npm` is `ENOENT` because
PATHEXT resolution is a shell behavior; `npm.cmd` is `EINVAL` because Node refuses
to spawn `.cmd` shell-less after the CVE-2024-27980 hardening. `shell: true` fixes
both, which is exactly why it is the answer everyone reaches.

Note the two conditions have to coincide — an unresolvable command AND untrusted
text in argv — so the vulnerability hides behind a path most of your calls never
take.

## Workaround

Resolve the target yourself and spawn shell-less, then treat the fallback as a
decision rather than a default:

```js
// 1. PATH x PATHEXT walk -> absolute path
// 2. .exe        -> spawn directly, no shell
//    .cmd/.bat   -> cmd.exe /d /s /c with windowsVerbatimArguments and caret escaping
// 3. unresolvable AND argv carries untrusted text -> REFUSE, do not fall back
```

Gate the refusal on argv CONTENT, not on a per-tool allowlist. An allowlist says
"this caller is safe", which stops being true the day someone adds a positional
prompt to it; inspecting the values cannot go stale that way.

When you scan for separators, do not include `(`, `)`, or `"`. cmd.exe treats them
as syntax, but they appear in ordinary paths — `C:\Program Files (x86)` is the
obvious one — so refusing on them breaks normal installs. Refuse on the subset
that can actually start a second command: `& | < > ^ % !`.

Best of all, pass user text on stdin. A value that never enters argv cannot be
re-parsed by anything.

---

`oss-native-arg-quoting` is the PowerShell-side wound: argv rebuilt on the way to
a native command. This is the cmd.exe side, and the specific trap is that the fix
for two well-known Windows spawn errors IS the vulnerability.
