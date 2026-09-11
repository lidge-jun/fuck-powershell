---
title: "the strict parser is the one that saves you: a Windows path in a loose config string loses every separator and fails much later under a filename nobody wrote"
description: "parsing landmine — misleading-error (both)"
sidebar:
  label: "config string eats windows PATH"
---

<p class="case-eyebrow">parsing · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#loose-string-escape-layer">loose-string-escape-layer</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">MODULE NOT FOUND</span></div><div class="row"><span class="k">Mechanism</span><span class="v">loose string escape layer</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">forward slashes in config</span></span></div></div>

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

## Refs

- <https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md>
- <https://github.com/LilMGenius/win-hooks/commit/30cdcb6dc235a7f250f590f2fb6986bb0b2977b9>
