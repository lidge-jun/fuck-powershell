---
title: "Spreading {...env, PATH} leaves the old Path sitting next to it"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "env PATH vs PATH casing"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#env-casing">env-casing</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">env casing</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">env remerge</span></span></div></div>

## Symptom

JS code overrides PATH for a child process: `{...process.env, PATH: shimDir}`.
On Windows the child sometimes resolves tools from the ORIGINAL path anyway —
the shim directory is ignored, intermittently, depending on which library reads
the env.

## Repro

```js
// Windows: process.env has key "Path" (registry casing)
const env = { ...process.env, PATH: "C:\\shims" };
// env now has BOTH "Path" (inherited) and "PATH" (yours).
// Consumers reading env.Path, or iterating keys first-match, use the old list.
```

## Cause

Windows environment variable NAMES are case-insensitive, but JS objects are
case-sensitive. The inherited key is usually `Path`; adding `PATH` creates a
duplicate rather than replacing it. Which one wins depends on the consumer —
CreateProcess dedupes one way, Node libraries another.

## Workaround

- Find the existing key case-insensitively and overwrite THAT key:
  `const k = Object.keys(env).find(x => x.toUpperCase()==="PATH") ?? "PATH"`.
- Never introduce a second casing into a copied env (the referenced fix's
  lookup() does exactly this).

## 2026-09-23 first-party CI occurrence

In OpenCodex's `tests/server/proxy-env.test.ts`, a table assigned `ALL_PROXY`
and `all_proxy` to different proxy URLs, including a SOCKS-only expectation.
Windows treats the names as one variable, so the later assignment replaced the
earlier one and the SOCKS proxy was absent. CI run 35816090505 exposed it on
`windows-latest`; PR #5634 makes the Windows assertion match the collapsed
environment instead of skipping the test.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/371aa579d61c5772a26c55ecfb907ca4541a5320>
- <https://github.com/lidge-jun/opencodex/actions/runs/35816090505>
- <https://github.com/lidge-jun/opencodex/pull/5634>
