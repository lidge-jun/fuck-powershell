---
title: "Get-Command and where.exe disagree about which npm exists, and both hand you an unrunnable path"
description: "aliases landmine — misleading-error (both)"
sidebar:
  label: "Get-Command vs where.exe"
---

<p class="case-eyebrow">aliases · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#pathext-resolution">pathext-resolution</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#cmd-reparse">cmd-reparse</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, cmd, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">EFTYPE, ENOENT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">pathext resolution, cmd reparse</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">get command</span></span></div></div>

# Get-Command and where.exe disagree about which npm exists, and both hand you an unrunnable path

## Symptom

You ask PowerShell where a tool lives, spawn what it tells you, and get an error
code you have never seen. Ask a *different* resolver and you get a different
path, which fails a different way. Neither answer is runnable.

```
Get-Command npm  ->  C:\Program Files\nodejs\npm.ps1   ->  spawn EFTYPE
where.exe npm    ->  C:\Program Files\nodejs\npm       ->  spawn ENOENT
```

Meanwhile `npm --version` typed into the same prompt works perfectly.

## Repro

```powershell
(Get-Command npm).Source          # C:\Program Files\nodejs\npm.ps1
(Get-Command npm).CommandType     # ExternalScript

where.exe npm
# C:\Program Files\nodejs\npm
# C:\Program Files\nodejs\npm.cmd
```

The two resolvers do not even agree on which files **exist**:

```powershell
Get-Command npm -All | ForEach-Object { $_.CommandType.ToString() + " -> " + $_.Source }
# ExternalScript -> ...\npm.ps1     <- where.exe never lists this
# Application    -> ...\npm.cmd
# Application    -> ...\npm
```

`Get-Command` ranks `.ps1` **first** and `where.exe` omits it **entirely**, because
one enumerates PowerShell command types and the other walks PATHEXT. Whichever
one your detection code calls determines which way you fail.

## Cause

### Spawn results for all three candidates

| what resolved it | path | `spawnSync` result |
|---|---|---|
| `Get-Command` (rank 1) | `npm.ps1` | **EFTYPE** |
| `where.exe` (rank 1) | `npm` (extensionless) | **ENOENT** |
| neither, by hand | `npm.cmd` | works — see below |

`EFTYPE` is the interesting one: it is not in most people's mental error table,
so it reads as "corrupt binary" rather than "this is a script that needs an
interpreter". The extensionless file is a POSIX `sh` script, hence `ENOENT` from
`CreateProcess`.

### The `.cmd` path has one more trap

Picking `.cmd` is correct, but the obvious ComSpec invocation still fails when
the path contains a space:

```js
spawnSync(process.env.ComSpec, ["/d","/s","/c", `"${target}" --version`],
          { windowsVerbatimArguments: true });
// exit 1
// stderr: 'C:\Program' is not recognized as an internal or external command
```

`cmd /s /c` strips the **outer** pair of quotes from the entire command line, so
your quotes around the path are the ones removed. Wrap twice:

```js
spawnSync(process.env.ComSpec, ["/d","/s","/c", `""${target}" --version"`],
          { windowsVerbatimArguments: true });
// exit 0
// stdout: 10.9.2
```

## Workaround

```powershell
# ask for Application only, and prefer .cmd/.exe explicitly
Get-Command npm -All |
  Where-Object { $_.CommandType -eq 'Application' -and $_.Source -like '*.cmd' } |
  Select-Object -First 1 -ExpandProperty Source
```

In spawn logic: never trust rank 1 from either resolver. Enumerate all
candidates, filter to `.exe` then `.cmd`, reject `.ps1` and extensionless, and
double-quote the ComSpec command line.

---

`npm-ps1-not-comspec` establishes that the `.ps1` shim wins the PATH race and
cannot be launched. This case adds the part that makes it hard to diagnose: the
two resolvers you would use to investigate **disagree about which files exist**,
so the tool you reach for decides which error you see. It also records `EFTYPE`
as the concrete spawn code, and the `cmd /s /c` double-quoting requirement, none
of which appear in the archive.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14,
npm 10.9.2.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/9>
