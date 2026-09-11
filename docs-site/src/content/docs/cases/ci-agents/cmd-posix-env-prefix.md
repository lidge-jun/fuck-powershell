---
title: "VAR=value cmd is not cmd.exe syntax — npm scripts break on Windows"
description: "ci-agents landmine — hard-error (both)"
sidebar:
  label: "CMD posix env prefix"
---

<p class="case-eyebrow">ci agents · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#posix-inline-env">posix-inline-env</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, cmd, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">COMMAND NOT RECOGNIZED</span></div><div class="row"><span class="k">Mechanism</span><span class="v">posix inline env</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">node env wrapper</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8>
