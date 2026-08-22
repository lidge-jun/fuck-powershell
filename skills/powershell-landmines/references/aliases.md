
# command -v silently reports every tool as missing

## Symptom

An agent (or a ported bash script) probes for a tool with `command -v foo` under
PowerShell. The probe prints nothing and the script concludes the tool is
missing — even though it is installed and on PATH. Installs get re-run,
bootstraps loop, "missing dependency" errors lie.

## Repro

```powershell
command -v git      # prints nothing, no error, $? stays true
Get-Command git     # works: CommandType Application, path shown
```

## Cause

PowerShell has no `command` builtin. Depending on parse context, `command -v git`
either matches nothing quietly or binds to unrelated tokens; it raises no error
and sets no useful exit state. The bash idiom fails in the WORST way: silently,
with a plausible-looking negative result.

## Workaround

- Probe with `Get-Command <tool> -ErrorAction SilentlyContinue` (null check) or
  simply run `<tool> --version` and check `$LASTEXITCODE`.
- Agent prompts targeting Windows must map `command -v` → `Get-Command`; the
  referenced commit ships that rule as a documented shell-hazard contract.


---


# curl silently becomes Invoke-WebRequest

## Symptom

A script or coding agent runs `curl -s -o out.json https://api.example.com` under
Windows PowerShell and gets a parameter-binding error, a prompt hanging on input, or
an HTML-ish object instead of a file. The error mentions `Invoke-WebRequest`
parameters, not curl — which sends you debugging the wrong tool.

## Repro

```powershell
# Windows PowerShell 5.1
Get-Command curl          # -> Alias  curl -> Invoke-WebRequest
curl -s https://example.com
# Invoke-WebRequest : Parameter cannot be processed because the parameter name 's'
# is ambiguous. Possible matches include: -SessionVariable -SkipCertificateCheck ...
```

Observed live: an AI agent driving a Slack integration issued `curl` for an API
round-trip; PowerShell resolved the alias, the flags bound to Invoke-WebRequest
parameters, and the call failed with an error that pointed nowhere near the cause.

## Cause

Windows PowerShell 5.1 ships `curl` and `wget` as built-in aliases for
`Invoke-WebRequest`. An upstream attempt to remove them (PR #1901) was closed
unmerged for compatibility; 5.1 keeps the aliases forever. PowerShell 7 removed
them on all platforms, so the same command behaves differently across versions.

## Workaround

- Call `curl.exe` explicitly — the `.exe` suffix bypasses alias resolution.
- Or use `Invoke-RestMethod`/`Invoke-WebRequest` with native parameters on purpose.
- Agent system prompts targeting Windows should ban bare `curl`/`wget`.


---


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


---


# npm's .ps1 shim wins the PATH race and nothing can run it

## Symptom

Tool detection finds "npm" but every attempt to execute it fails: cmd.exe says
it can't run the file, spawn calls error out, or execution policy blocks it.
Meanwhile `npm.cmd` sits right next to it, working fine.

## Repro

```powershell
# npm installs THREE shims side by side: npm, npm.cmd, npm.ps1
Get-Command npm     # PowerShell may resolve npm.ps1 first
# cmd.exe /c npm.ps1  → not executable via ComSpec
# Restricted policy   → npm.ps1 blocked entirely
```

## Cause

npm ships `tool`, `tool.cmd`, and `tool.ps1` shims. `Get-Command` and PATHEXT
resolution can select the `.ps1`, which (a) execution policy may block, (b)
cmd.exe/ComSpec cannot execute, and (c) CreateProcess cannot launch directly.
The extensionless file is a POSIX sh script — equally unrunnable natively.

## Workaround

- Resolve explicitly in preference order `.exe` > `.cmd`, never `.ps1`:
  `Resolve-CommandPath @('npm.cmd','npm.exe','npm')` or
  `Get-Command npm -CommandType Application`.
- In spawn logic, treat `.ps1` as non-launchable (needs an interpreter);
  the referenced fix rejects it even when PATHEXT lists it.


---


# bare npm is ENOENT and npm.cmd is EINVAL - the same tool, two different lies

## Symptom

Any Node program that spawns a package-manager CLI dies on Windows, and the two
obvious spellings fail with two *different* errors, which sends you down two
different wrong paths:

```
spawnSync npm ENOENT
spawnSync npm.cmd EINVAL
```

`ENOENT` reads as "npm is not installed" and `EINVAL` reads as "bad arguments".
Neither is true. npm works fine from the same shell.

## Repro

```js
const { spawnSync } = require("node:child_process");
spawnSync("npm", ["--version"], { encoding: "utf8" }).error.code;     // ENOENT
spawnSync("npm.cmd", ["--version"], { encoding: "utf8" }).error.code; // EINVAL
```

Verified on Windows 11, Node 22.14 and 24.19.

## Cause

Two unrelated facts stacked:

1. There is no file named `npm` on disk. PATHEXT resolution is a *shell*
   behavior, and `spawnSync` without `shell: true` does not perform it, so the
   bare name genuinely does not exist -> `ENOENT`.
2. `npm.cmd` does exist, but Node refuses to spawn `.cmd`/`.bat` shell-less
   after the CVE-2024-27980 hardening -> `EINVAL`.

So the correct-looking fix for the first error walks straight into the second.

## Why `shell: true` is not the answer

It is the first thing everyone reaches for, and it is a security regression when
the command is user-supplied: Node does not escape cmd metacharacters in that
mode, so an argument containing `&` or `^` becomes command injection. This repo's
own `oss-native-arg-quoting` case is the same wound from the other side.

## Workaround

Resolve the command yourself, then route by extension:

```js
// PATH x PATHEXT walk -> absolute path
// .exe  -> spawn directly
// .cmd/.bat -> cmd.exe /d /s /c "<caret-escaped line>" with
//             windowsVerbatimArguments: true
```

Prefer `.exe` over `.cmd`, and never `.ps1` (see `npm-ps1-not-comspec`).

---

`npm-ps1-not-comspec` covers the `.ps1` shim winning the PATH race. This is the
adjacent trap: the `.cmd` shim is the one you are *told* to prefer, and Node
refuses it too. Worth its own entry because the fix is different (an escaped
ComSpec hop, not a preference reorder) and the error pair is what people search.

## Real-world hit

lidge-jun/codexclaw#40 — `cxc receipt test -- npm test` could not run on Windows,
which blocked the documented path to close a work phase.
Fix: https://github.com/lidge-jun/codexclaw/commit/5c03acb
