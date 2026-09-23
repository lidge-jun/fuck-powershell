---
title: "writing to nul.txt succeeds and creates nothing, because a handful of MS-DOS device names are still reserved in every directory"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "reserved dos device names"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#dos-device-namespace">dos-device-namespace</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, cmd, node, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">dos device namespace</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">reject device names</span></span></div></div>

## Symptom

A file write reports success and the file is not there. No exception, no error
code, nothing in the directory listing:

```
C:\> echo hello > nul.txt
C:\> dir nul.txt
File Not Found
```

The realistic version is not someone typing `nul.txt`. It is an extractor
unpacking an archive that contains `aux`, a generator naming a file from a data
field that happens to be `con`, or a test fixture named after a case id. Those
work on Linux and macOS, so they reach Windows already committed.

## Repro

```
C:\> echo hello > NUL.txt
C:\> echo hello > NUL.tar.gz
C:\> mkdir sub && echo hello > sub\NUL.txt
C:\> dir /b
sub
```

Microsoft's own documented example, with the superscript form:

```
C:\> echo test > COM¹
```

That "fails to create a file" — the docs say so in those words, and the
superscript digits are the sentence that makes the reservation explicitly apply
in every directory rather than only at the root.

On Linux and macOS all of these are ordinary filenames.

## Cause

`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9` and the ISO-8859-1
superscript forms (`COM¹`, `COM²`, `COM³`, and the `LPT` equivalents) are MS-DOS
device aliases that Win32 still honors. Path parsing recognizes a legacy device
name as its own path type and rewrites it into the NT device namespace before any
directory is applied, so `C:\anywhere\NUL.txt` resolves to the Null device rather
than to a file in that folder.

Three details do most of the damage:

- **An extension does not help.** Microsoft documents `NUL.txt` and
  `NUL.tar.gz` as both equivalent to `NUL`.
- **`CreateFile` opens devices as well as files**, so the call SUCCEEDS. That is
  why there is no error to catch: your bytes went to the Null device, and a
  write to `CON` goes to the console instead.
- **The list is exact and short.** `COM10`, `COM0`, `CON1`, and `console.txt` are
  not reserved. `CON.txt` is. Serial ports past 9 need the `\\.\COM56` form
  precisely because they are not in the legacy set.

When a reserved-name call fails rather than succeeds, the runtime error adds a
second layer of confusion. Following the published mapping tables, Win32
`ERROR_INVALID_NAME` (123) reaches Node as `ENOENT` and Python as `EINVAL`, so
the same wall would carry two different names depending on your language. Which
Win32 code a given reserved name actually returns, for a given open disposition,
is not something this corpus has executed — see the verification note.

Windows 11 did not repeal this. What changed there is narrower: .NET's
`Path.GetFullPath` no longer rewrites a path that BEGINS with a legacy device
name. The reserved-name list itself is current documentation.

## Workaround

Reject or mangle the closed set at the Windows boundary, matching on the stem
rather than the whole filename:

```js
const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\.|$)/i;
if (RESERVED.test(basename)) throw new Error(`reserved device name: ${basename}`);
```

Put that check in generators, archive extractors, and fixture naming — the three
places that produce filenames nobody typed.

What does not work: adding an extension, moving it into a subdirectory, or
trusting an existence check afterwards. `Test-Path` and `fs.existsSync` can be
answering for the device rather than for a file.

The `\\?\` extended-length prefix disables the path parsing that performs the
device rewrite, which is the documented mechanism — but it applies only to
fully-qualified Unicode paths on APIs that accept it, and Explorer is not
guaranteed to understand what you create that way. Treat it as a targeted escape
hatch, not an application-wide setting.

## Verification note

Quoted from Microsoft's file-naming documentation: the reserved list including
the superscript forms, the "reserved in every directory" statement, the
`NUL.txt` and `NUL.tar.gz` equivalence, and `echo test > COM¹` failing to create
a file.

NOT executed, and therefore stated as inference rather than observation: the
exact Win32 error a given reserved-name open returns and how each runtime maps
it; whether a `\\?\`-prefixed `nul.txt` create produces a real file (the docs
say the prefix disables the parsing that performs the device rewrite, which is
not the same sentence); and whether reading `con.txt` blocks on console input.
This corpus has no Windows host, hence `repro: historical`.

---

`test-path-trailing-whitespace` is the other case where Win32 path parsing
silently rewrites what you asked for. There a trailing space is stripped; here a
whole name is redirected to a device.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/39>
- <https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file>
- <https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats>
- <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
