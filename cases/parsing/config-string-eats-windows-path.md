---
id: config-string-eats-windows-path
title: "the strict parser is the one that saves you: a Windows path in a loose config string loses every separator and fails much later under a filename nobody wrote"
category: parsing
versions: "both"
failure: misleading-error
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/30cdcb6dc235a7f250f590f2fb6986bb0b2977b9
ontology:
  affects: [env-windows, runtime-node]
  invokes: [command-node]
  manifests_as: [error-module-not-found]
  caused_by: [mechanism-loose-string-escape-layer]
  mitigated_by: [workaround-forward-slashes-in-config]
  related_to: [case:git-merge-driver-sh-escapes]
---

# the strict parser is the one that saves you: a Windows path in a loose config string loses every separator and fails much later under a filename nobody wrote

## Symptom

```
Cannot find module 'C:Userssmsmesrc\index.js'
```

The path in the error is not the path in the config file. The separators are gone
and the words have run together. Nobody typed that string, so the natural
conclusion is that the tool which *wrote* the config has a bug — win-hooks records
that this was misdiagnosed exactly that way, as a plugin defect, before the real
cause was found.

## Repro

The same bytes through three layers:

```
source                : {"p": "C:\Users\smsme\src"}

strict JSON.parse     -> THROWS  Bad escaped character in JSON at position 10
JS string literal     -> "C:Userssmsmesrc"
re-escaped, then JSON -> "C:\Users\smsme\src"

import of the mangled value
  -> ERR_MODULE_NOT_FOUND: Cannot find module 'C:Userssmsmesrc\index.js'
```

Measured on Node 24. The interesting row is the first one.

## Cause

`\U` and `\s` are not valid escapes.

A **strict** JSON parser refuses the whole document and tells you at load time.
That is the good outcome, and it is why "JSON ate my path" is the wrong way round:
JSON is the layer that catches this.

A **loose** layer — a JavaScript string literal, JSON5, a hand-rolled config
reader, a templating step that interpolates before parsing — drops the backslash
and keeps the letter. No error, no warning, and a value that still looks like a
path. The failure surfaces much later, in a module loader or a file open, under a
name that appears in no source file.

The Windows-specific part is which letters get eaten. `\n`, `\t` and `\b` are
famous; the ones that actually bite are `\U` in `\Users`, `\s` in `\src`, `\D` in
`\Documents` and whatever your username starts with. Those are ordinary directory
names, so every Windows path is a candidate and every POSIX path is safe — which is
why this never shows up until somebody runs your tool on Windows.

## Workaround

Write drive-letter paths with forward slashes in configuration:

```json
{ "entry": "C:/Users/smsme/src/index.js" }
```

Scope that advice honestly: the loaders that consume configs like this — Node,
Python, `CreateFile` — all accept forward slashes. `cd` in cmd.exe, some
installers and some schema validators do not, so this is a rule about config
strings, not a claim that Windows accepts forward slashes everywhere.

If backslashes must survive, double them where the value is **generated**, not
where it fails. A repair applied downstream cannot distinguish a path that lost a
separator from a path that never had one.

And prefer the strict parser. A config format that throws on an invalid escape is
doing you a favour; swapping it for a lenient one to "make the error go away"
converts a load-time failure into a runtime one.

## Related

`git-merge-driver-sh-escapes` is the same class one layer down: there it is git's
`sh` that treats the backslash as an escape, `C:\Users\me` becomes `C:Usersme`,
and the merge driver that never ran looks like a conflict. Same mechanism,
different consumer, different error text.

