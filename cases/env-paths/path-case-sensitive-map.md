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
  - https://github.com/lidge-jun/fuck-powershell/issues/43
  - https://github.com/openai/codex/issues/40002
ontology:
  affects: [env-windows, runtime-node]
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

require("fs").statSync("c:\\users\\me\\project").ino ===
require("fs").statSync("C:\\Users\\me\\Project").ino;   // same file
```

The two spellings name one file and are two distinct strings. On Linux they would
name two different files, so the string comparison would be right.

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

For a real identity check rather than a key, compare resolved paths through the
filesystem: `realpathSync` on both sides handles casing, junctions, and symlinks
together.

---

`env-path-vs-PATH-casing` is the environment-variable version — `Path` versus
`PATH` as a variable NAME. This is the filesystem version, and the trap is
sharper: there the two names refer to one variable by design, here two strings
refer to one file while your data structure insists they are two.
