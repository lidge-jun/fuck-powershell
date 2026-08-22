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

// shell-less: one argument, exactly as written
spawnSync("mytool.exe", ["--prompt", userText], { stdio: "inherit" });

// with the shell: cmd.exe sees
//   mytool.exe --prompt summarize this & calc
// and runs calc.exe as a second command
spawnSync("mytool.exe", ["--prompt", userText], { shell: true, stdio: "inherit" });
```

With a `.cmd` target the contrast is starker still, because there is no working
shell-less version to compare against: shell-less it is `EINVAL`, and with the
shell it is injectable. The fix for the first problem is the second problem.

Node joins argv with spaces, escapes nothing, and hands the result to
`cmd.exe /d /s /c "<joined>"`. Inside that line `&`, `|`, `<`, `>`, `^`, `%VAR%`,
and a raw newline are all syntax.

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

Refuse on the characters that can actually start a second command:
`& | < > ^ % !`, plus CR and LF, which cmd.exe treats as command boundaries.

Parentheses are the one deliberate omission: cmd.exe treats them as grouping
syntax, but they appear in ordinary paths — `C:\Program Files (x86)` — so
refusing on them breaks normal installs on a compatibility path whose purpose is
to keep unusual installs working. Double quotes are NOT in that category. They do
not appear in ordinary paths, and they terminate the wrapper quoting Node puts
around the joined line, so keep them in the refusal set.

Best of all, pass user text on stdin. A value that never enters argv cannot be
re-parsed by anything.

---

`oss-native-arg-quoting` is the PowerShell-side wound: argv rebuilt on the way to
a native command. `cmd-shim-reparses-argv` is the same cmd.exe re-parse reached by
spawning a shim on purpose, and `spawn-npm-enoent-einval` is where the two errors
that push you here come from — it names `shell: true` as its unsafe fix, and this
case is what that fix costs.

The distinct reader here is the one who already applied the fix: it worked, the
error went away, and nothing since has told them that one argument in that call
is now interpreted rather than passed.
