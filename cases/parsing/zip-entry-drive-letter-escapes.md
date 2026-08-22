---
id: zip-entry-drive-letter-escapes
title: "your zip extractor rejects ../ and still writes to C:/Windows, because a drive letter is absolute without a leading slash"
category: parsing
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/29
  - https://github.com/lidge-jun/agbrowse/commit/a5519f3a516c4064b8211da107d148889cf1a86b
  - https://github.com/lidge-jun/agbrowse/commit/b21aae8332
ontology:
  affects: [env-windows, runtime-node, env-win32-api]
  caused_by: [mechanism-win32-path-normalization]
  mitigated_by: [workaround-reject-drive-and-raw-dotdot]
---

# your zip extractor rejects ../ and still writes to C:/Windows, because a drive letter is absolute without a leading slash

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
