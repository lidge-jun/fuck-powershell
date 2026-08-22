---
title: "your zip extractor rejects ../ and still writes to C:/Windows, because a drive letter is absolute without a leading slash"
description: "parsing landmine — silent (both)"
sidebar:
  label: "zip entry drive letter escapes"
---

<p class="case-eyebrow">parsing · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#win32-path-normalization">win32-path-normalization</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">win32 path normalization</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">reject drive and raw dotdot</span></span></div></div>

## Symptom

There is no symptom until someone uses it. A path guard that reads as thorough —
it strips `..`, it rejects paths starting with `/` — writes an archive entry
outside its destination on Windows and nowhere else.

The guard looks like this, and it is wrong in two independent ways:

```js
if (name.startsWith("..") || name.startsWith("/")) continue;   // "safe"
```

## Repro

```js
const path = require("node:path");

// 1. a drive-letter entry is absolute, and passes both checks
const a = "C:/Windows/System32/drivers/etc/hosts";
a.startsWith("..") || a.startsWith("/");   // false — allowed through
path.posix.isAbsolute(a);                  // false — the POSIX check agrees
path.win32.isAbsolute(a);                  // true  — only win32 knows

// 2. a nested traversal survives a prefix check
const b = "safe/../../evil.md";
b.startsWith("..");                        // false — allowed through
path.posix.normalize(b);                   // "../evil.md" — it escapes
```

And the drive-relative form, which is stranger still:

```js
path.win32.resolve("C:evil.txt");   // resolves against the CWD *of drive C*,
                                    // which is per-drive state, not your cwd
```

## Cause

"Absolute" is not one concept. On POSIX a path is absolute exactly when it starts
with `/`, so a single prefix check is a complete test. Windows has three
absolute-ish forms and only one of them starts with a separator:

- `C:\dir\file` — drive-absolute
- `C:file` — drive-RELATIVE, resolved against a per-drive current directory
- `\\server\share\file` — UNC

`path.posix.isAbsolute` is false for all three, and a Node program that normalizes
archive entries with `path.posix` — the sensible choice, since zip entry names use
forward slashes by spec — inherits that blindness. The file is then written with a
Win32 API that honors the drive letter perfectly well.

The second half is that prefix checks and normalization are different operations.
`safe/../../evil.md` does not start with `..`; it becomes `../evil.md` only after
you normalize it. Checking before normalizing tests a string that will not be the
one used.

## Workaround

Normalize first, then reject on the normalized value, and add the Windows forms
the POSIX check cannot see:

```js
function safeEntryName(entry) {
  const raw = String(entry).replace(/\\/g, "/");
  const normalized = path.posix.normalize(raw);
  if (
    raw.split("/").includes("..") ||          // no raw traversal segment at all
    normalized === "." || normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:(?:\/|$)/.test(normalized)     // C:/ and bare C:
  ) return null;
  return normalized;
}
```

Rejecting any raw `..` segment — even one that normalizes away, like
`safe/../x` — costs you nothing in a context you control and removes a whole
class of normalization-order bugs.

The belt-and-braces version, worth it when the archive is untrusted: resolve the
final path and verify it is still inside the destination with
`path.relative(dest, resolved)`, checking that the result neither starts with
`..` nor is absolute. That catches forms nobody enumerated.

---

`path-colon-not-delimiter` is the other half of the colon problem: code that
splits a PATH-like string on `:` cuts drive letters in half. Here the colon is
not being split on but being ignored, and the result is a write outside the
sandbox.

## Refs

- <https://github.com/lidge-jun/agbrowse/commit/a5519f3a516c4064b8211da107d148889cf1a86b>
- <https://github.com/lidge-jun/agbrowse/commit/b21aae8332>
