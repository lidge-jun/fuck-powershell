---
title: "your allowlist matches on a basename computed with split slash, so every Windows client silently bypasses it"
description: "parsing landmine — silent (both)"
sidebar:
  label: "basename split slash only"
---

<p class="case-eyebrow">parsing · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#win32-path-normalization">win32-path-normalization</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">win32 path normalization</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">normalize separators first</span></span></div></div>

## Symptom

A filter works. You tested it, the tests pass, and it does nothing for a subset
of your users — the ones on Windows. Blocklists do not block, allowlists do not
allow, caches never hit, and routing sends things to the wrong place.

There is no error, because a basename computation cannot fail. It just returns
the wrong string, and the comparison that follows honestly reports no match.

The version that cost real money: a server elided oversized skill bundles by
matching the directory basename against a blocklist. Windows clients sent
`C:\Users\me\.claude\skills\claude-api`, the basename came out as the whole
path, nothing matched, and 790,000-character bundles went to a metered model.

## Repro

```js
const dir = "C:\\Users\\me\\.claude\\skills\\claude-api";

dir.split("/").filter(Boolean).pop();
// "C:\Users\me\.claude\skills\claude-api"   <- the entire path

blocked.includes(that);   // false, forever
```

The POSIX input works, which is why this ships:

```js
"/home/me/.claude/skills/claude-api".split("/").pop();   // "claude-api"
```

## Cause

`split("/")` on a backslash-separated path finds no separators, so it returns a
one-element array and `.pop()` hands back the input unchanged. Every subsequent
string operation is then comparing a full path against a bare name.

This is specifically a hazard for paths that arrive as DATA rather than being
built locally: a request body, a config value, a manifest entry, a log line. Code
that builds paths with `path.join` gets the host's separator and stays consistent
with itself; code that receives a path from a client gets the CLIENT's separator,
and on a POSIX server that is the one separator your local tests never produce.

`path.basename` does not save you here either. The POSIX build of it — which is
what `node:path` gives you on a Linux server — treats backslash as an ordinary
filename character, so it returns the same wrong answer as the manual split.

Three variants to expect in the same input: backslash (`C:\a\b`), mixed
(`C:/a\b`), and UNC (`\\\\server\\share\\b`).

## Workaround

Normalize separators before you split, at the point the untrusted path enters:

```js
const base = dir.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
```

If both separators are possible and you want the platform-correct answer, use
`path.win32.basename` explicitly for client-supplied Windows paths rather than
the ambient `path.basename`, whose behavior depends on where your server happens
to run.

And when a security or cost decision depends on the result, add a test with a
backslash path. This class of bug is invisible to every fixture written by
someone on a Mac.

---

`zip-entry-drive-letter-escapes` is the same blindness pointed at absoluteness
rather than at the basename: POSIX path logic applied to a Windows path that a
Windows API will happily honor.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/31>
- <https://github.com/lidge-jun/opencodex/commit/fe1a5ea2cc552f4f46ddfc515d03ea5ac0ab1b3a>
