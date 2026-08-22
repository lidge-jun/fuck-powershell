---
id: cmd-posix-env-prefix
title: "VAR=value cmd is not cmd.exe syntax — npm scripts break on Windows"
category: ci-agents
versions: "both"
failure: hard-error
context: [ci, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8
---

# VAR=value cmd is not cmd.exe syntax — npm scripts break on Windows

## Symptom

A package.json script like `"test": "NODE_ENV=test node run.js"` works for
every contributor — until the first Windows contributor runs it:
'NODE_ENV' is not recognized as an internal or external command.

## Repro

```
# cmd.exe (npm's default script shell on Windows):
NODE_ENV=test node run.js
# 'NODE_ENV' is not recognized as an internal or external command
```

## Cause

VAR=value cmd is POSIX per-command environment syntax. cmd.exe has no such
form — it tries to execute the literal token NODE_ENV=test as a program. npm
runs scripts through cmd.exe on Windows, so the POSIX prefix silently
platform-locks the script.

## Workaround

- Route env-setting through a tiny Node wrapper (the referenced
  run-with-env.mjs pattern) or cross-env.
- Or set variables inside the Node process; keep package.json scripts
  shell-neutral.
