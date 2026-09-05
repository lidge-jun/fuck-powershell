---
id: path-case-sensitive-map
title: "the filesystem says two paths are the same file and your config map says they are two keys, so a trusted project reads as untrusted"
category: env-paths
versions: "both"
failure: silent
context: [script, agent, ci]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/opencodex/actions/runs/33945431119
  - https://github.com/lidge-jun/opencodex/pull/3629
  - https://github.com/lidge-jun/fuck-powershell/issues/43
  - https://github.com/openai/codex/issues/40002
  - https://learn.microsoft.com/en-us/windows/wsl/case-sensitivity
ontology:
  affects: [env-windows, runtime-node, runtime-bun]
  caused_by: [mechanism-case-insensitive-filesystem]
  mitigated_by: [workaround-canonical-path-key]
---

# the filesystem says two paths are the same file and your config map says they are two keys, so a trusted project reads as untrusted

## Symptom

A lookup keyed by a path misses, for a path that unambiguously exists and that
every other part of the system resolves fine:

```
Can't verify project trust for C:\Users\me\Codex-Orchestrator
```

The entry is right there in the config:

```toml
[projects.'c:\users\me\codex-orchestrator']
trust_level = "trusted"
```

Adding a SECOND entry with the exact casing the caller used fixes it immediately,
and both entries coexist happily — which is the tell that this is a key
comparison rather than a filesystem problem.

Caches miss, allowlists do not match, dedupe stores the same path twice, and a
"have I seen this before" check answers no forever.

## Repro

```js
const seen = new Map();
seen.set("c:\\users\\me\\project", true);
seen.has("C:\\Users\\me\\Project");   // false

const { realpathSync } = require("node:fs");
realpathSync("c:\\users\\me\\project") ===
realpathSync("C:\\Users\\me\\Project");   // true — one directory
```

The two spellings name one directory and are two distinct strings. On Linux they
would name two different directories, so the string comparison would be right.

Do not reach for `stat().ino` to prove identity here: on Windows the inode is
frequently reported as 0, so comparing it proves nothing at all.

## Cause

NTFS is case-INSENSITIVE and case-PRESERVING: it stores the casing you used and
ignores casing when matching. So the filesystem happily treats `c:\users\...` and
`C:\Users\...` as one object, while every ordinary string container — a `Map`, a
JSON object, a TOML table, a `Set`, a SQL unique index — treats them as two.

Where the differing casing comes from is the part you cannot control:

- a user hand-editing a config in lowercase
- `%USERPROFILE%` versus a literal `C:\Users\...` from a different component
- a short 8.3 name in `%TEMP%` for some accounts
- a drive letter that arrives lowercase from one API and uppercase from another
- a remote or mobile client sending the path it was shown

So the collision appears when TWO components meet, which is why it survives every
single-component test.

Lowercasing everything is the obvious fix and is wrong on its own: the same code
usually runs on Linux, where lowercasing makes two genuinely different files
collide. The correct key depends on the platform, which means it has to be
computed rather than assumed.

## Workaround

Canonicalize before using a path as a key, and make the canonicalization
platform-aware:

```js
const { resolve, sep, posix } = require("node:path");

function pathKey(p) {
  const abs = resolve(p).split(sep).join(posix.sep);
  return process.platform === "win32" ? abs.toLowerCase() : abs;
}
```

Normalize the separators too, or `C:/x` and `C:\x` become the next pair of keys
that should have matched.

When the key is persisted — a config file, a database, a lock file — canonicalize
on WRITE as well as on read, and migrate existing entries. A store that already
holds both spellings will keep answering inconsistently no matter how correct the
read path becomes.

For an identity check on existing paths, use filesystem resolution on both sides.
With Bun's Windows compatibility APIs, prefer `realpathSync.native`: ordinary
`realpathSync` and its native variant need not expand short names identically.
If the final file may not exist, resolve its existing parent directory and append
the expected literal filename; do not turn an absent-file case into an ENOENT test.

## First-party Bun occurrence: test fixture versus effective home

OpenCodex Windows run33945431119 failed the native Codex status-path assertion:
the fixture expected a temporary root under RUNNER~1, while the API returned the
same uniquely named fixture under runneradmin. The fixture used ordinary
realpathSync; the effective-home resolver used realpathSync.native. Lowercasing
cannot reconcile those two spellings.

PR #3629 canonicalizes the fixture's existing root with the native operation and
keeps the exact status-path assertion. An additional test switches from one real
home to a directory alias of a distinct second home while both config files are
absent. Returning the unresolved alias makes that test fail. No suffix-only or
casefolded assertion is substituted. Full Windows verification is tracked in
the PR; the historical trust-map report above is not being relabeled as a new repro.

---

`env-path-vs-PATH-casing` is the environment-variable version — `Path` versus
`PATH` as a variable NAME. This is the filesystem version, and the trap is
sharper: there the two names refer to one variable by design, here two strings
refer to one file while your data structure insists they are two.
