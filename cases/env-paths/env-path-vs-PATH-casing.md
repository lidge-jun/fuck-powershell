---
id: env-path-vs-PATH-casing
title: "Spreading {...env, PATH} leaves the old Path sitting next to it"
category: env-paths
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/371aa579d61c5772a26c55ecfb907ca4541a5320
  - https://github.com/lidge-jun/opencodex/actions/runs/35816090505
  - https://github.com/lidge-jun/opencodex/pull/5634
ontology:
  affects: [runtime-node, env-windows, env-win32-api]
  caused_by: [mechanism-env-casing]
  mitigated_by: [workaround-env-remerge]
---

# Spreading {...env, PATH} leaves the old Path sitting next to it

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
