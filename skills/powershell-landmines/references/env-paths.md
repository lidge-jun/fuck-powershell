
# node:path delimiter follows the HOST, so win32 PATH logic resolves nothing when tested from Linux

## Symptom

Windows PATH-resolution code is correct on Windows and silently resolves
**nothing** when the same function is exercised from Linux — a unit test, a CI
matrix, a cross-platform test that passes `platform: "win32"` as a parameter.

Nothing throws. The walk just finds no candidates, and the caller falls through
to whatever its "not found" branch does. On Windows the test passes, so the bug
ships in the direction nobody looks.

## Repro

```js
import { delimiter } from "node:path";

// A Windows PATH, being parsed by win32-only resolution logic
const winPath = "C:\\a;C:\\b;C:\\c";
winPath.split(delimiter);
// on Windows: ["C:\\a", "C:\\b", "C:\\c"]
// on Linux:   ["C:\\a;C:\\b;C:\\c"]   <- one bogus entry, no error
```

## Cause

`node:path`'s `delimiter` (and `sep`) follow the **host**, not the data. A
Windows PATH is always `;`-separated regardless of where the string is being
parsed. The moment you make platform a *parameter* — which is exactly what you do
to make win32 logic testable from CI — the host-derived constant stops matching
the input.

`path.win32.delimiter` exists and is the honest fix, but the bare import is what
editors autocomplete and what reads as "correct, cross-platform" in review.

## Workaround

- Split a Windows PATH on a literal `";"`, or use `path.win32.delimiter`
  explicitly. Same for `path.win32.sep` / `path.posix.sep`.
- Treat any host-derived constant inside platform-parameterized code as a bug:
  if `platform` is an argument, `delimiter`, `sep`, `homedir()` and
  `process.platform` must not appear in the same function.
- Assert the split in a test that runs on Linux, not just on Windows.

## Why it belongs here

This is the mirror image of most cases in this archive: not a POSIX assumption
exploding on Windows, but **Windows-handling code quietly failing everywhere
else**. It is the failure mode you get *after* you do the right thing and make
your win32 path logic testable off-Windows.

## Real-world hit

Shipped in three byte-identical copies of a shared helper in
lidge-jun/codexclaw and only surfaced when a win32-only resolver was exercised
from a WSL/Linux test lane.
Fix: https://github.com/lidge-jun/codexclaw/commit/5c03acb


---


# Appending to $env:Path and saving to User PATH copies Machine PATH in

## Symptom

After an installer "adds one directory to PATH", the user's User PATH suddenly
contains the entire system PATH — duplicated. Future Machine PATH changes get
shadowed by the stale copy, and the PATH grows every time the pattern runs.

## Repro

```powershell
# The innocent-looking pattern:
[Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\tools', 'User')
# $env:Path is the MERGED Machine+User view — you just wrote all of it into User.
```

## Cause

`$env:Path` is the process-level merge of Machine and User PATH. Using it as
the base for a User-scope write permanently copies every Machine entry into the
User value. The corruption is silent and compounds across installers.

## Workaround

```powershell
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*C:\tools*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;C:\tools", 'User')
}
```

Read the specific scope, append only the missing entry. The referenced fix
replaced the merged-view guidance with exactly this scope-read pattern.


---


# a WindowsApps alias on PATH spawns EPERM while passing every readability and reparse-point probe

## Symptom

A tool installed from the Microsoft Store (or any app that ships an execution
alias) is on PATH, and spawning it fails with `EPERM` — not `ENOENT`. cmd.exe
says "Access is denied." Running the same name interactively works fine.

`EPERM` sends you hunting for a permissions or antivirus problem. There isn't one.

## Repro

```js
// PATH contains C:\Program Files\WindowsApps\...\codex.exe
const { spawnSync } = require("node:child_process");
const p = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_.../codex.exe";

require("node:fs").accessSync(p, require("node:fs").constants.R_OK); // OK
require("node:fs").accessSync(p, require("node:fs").constants.X_OK); // OK
require("node:fs").lstatSync(p).isSymbolicLink();                    // false

spawnSync(p, ["--version"]).error.code;                              // EPERM
```

Measured on Windows 11 with the Codex desktop app installed. The file is
**readable**, passes **X_OK**, is **not a reparse point**, and reports a real size
(297 MB) — and `CreateProcess` still refuses it.

## Cause

Store-packaged apps expose an *app execution alias*. The shell knows how to
activate the package behind it; a direct `CreateProcess` does not, and the
refusal surfaces as `EPERM`.

The nasty part is the detection story. Every heuristic that sounds right fails:

| Probe | Result | Useful? |
|---|---|---|
| `existsSync` | true | no |
| `access(R_OK)` | passes | no |
| `access(X_OK)` | passes | no |
| `lstat().isSymbolicLink()` | false | no |
| size looks like a stub | 297 MB | no |

The advice you find online — "skip unreadable reparse points" — does not catch
this binary at all. The only reliable discriminator is the `WindowsApps` **path
segment itself**.

## Workaround

Filter the PATH walk by whole path segment, and keep a shell hop as the fallback,
since the shell *can* start the alias:

```js
const isStoreAlias = (p) => /(^|[\\/])WindowsApps([\\/]|$)/i.test(p);
```

Match it as a whole segment so a directory named `MyWindowsAppsBackup` is not
swept up. Ladder that worked: explicit override env var, then a PATH/PATHEXT walk
that skips WindowsApps, then a caret-escaped `cmd.exe` hop.

## Real-world hit

lidge-jun/codexclaw#33 — a trust-registration command died here on every run, and
because the failure was in a *verification* step the tool rolled back a write that
had actually succeeded.
Fix: https://github.com/lidge-jun/codexclaw/commit/071eb40


---


# Spreading {...env, PATH} leaves the old Path sitting next to it

## Symptom

JS code overrides PATH for a child process: `{...process.env, PATH: shimDir}`.
On Windows the child sometimes resolves tools from the ORIGINAL path anyway —
the shim directory is ignored, intermittently, depending on which library reads
the env.

## Repro

```js
// Windows: process.env has key "Path" (registry casing)
const env = { ...process.env, PATH: "C:\\shims" };
// env now has BOTH "Path" (inherited) and "PATH" (yours).
// Consumers reading env.Path, or iterating keys first-match, use the old list.
```

## Cause

Windows environment variable NAMES are case-insensitive, but JS objects are
case-sensitive. The inherited key is usually `Path`; adding `PATH` creates a
duplicate rather than replacing it. Which one wins depends on the consumer —
CreateProcess dedupes one way, Node libraries another.

## Workaround

- Find the existing key case-insensitively and overwrite THAT key:
  `const k = Object.keys(env).find(x => x.toUpperCase()==="PATH") ?? "PATH"`.
- Never introduce a second casing into a copied env (the referenced fix's
  lookup() does exactly this).


---


# $env:USERDOMAIN is not your identity

## Symptom

An ACL/permissions script builds a principal as `"$env:USERDOMAIN\$env:USERNAME"`
and passes it to `icacls`. It works on the dev machine, then fails on a renamed
computer, a Microsoft-account login, or an AzureAD-joined machine: icacls cannot
resolve the principal, the grant fails, and if the code fails closed, the whole
feature dies.

## Repro

```powershell
# On a workgroup (non-domain) machine:
$env:USERDOMAIN          # -> COMPUTERNAME, not a domain
# Microsoft-account login: local profile name != account name
icacls secret.txt /grant "$env:USERDOMAIN\$env:USERNAME:(R)"
# -> "No mapping between account names and security IDs was done."
```

## Cause

`USERDOMAIN` is always set — on a workgroup machine it silently holds the computer
name, so `domain ? "domain\user" : user` fallbacks never fire. Both variables are
also plain environment values, writable by whatever launched the process, which
makes them attacker-influenceable in a permissions path.

## Workaround

Use the SID, which is what the token actually carries and which icacls accepts
directly:

```powershell
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls secret.txt /grant "*${sid}:(R)"
```

The referenced production fix replaced the env-derived principal with the current
token's SID for exactly the failure modes above.


---


# Joining PATH with ':' silently no-ops on Windows

## Symptom

A test or script prepends a directory to PATH with a colon:
PATH = binDir + ":" + oldPath. On Windows the tool in binDir is never found —
no error, the entry just does not participate in resolution.

## Repro

```js
process.env.PATH = binDir + ":" + process.env.PATH;   // POSIX habit
// Windows PATH is ;-separated: the whole thing becomes ONE bogus entry
// "C:\\bin:C:\\Windows\\system32;..." — binDir is unfindable.
```

## Cause

Windows separates PATH entries with semicolons; colons appear INSIDE entries as
drive designators (C:). A colon-joined PATH fuses your new directory with the
first original entry into one nonexistent path. The same bug appears in
PowerShell as \$env:Path = "\$bin:\$env:Path".

## Workaround

- Use the platform delimiter: Node path.delimiter (the referenced fix), or
  [IO.Path]::PathSeparator in PowerShell.
- Sibling traps: splitting on ':' shreds C:\\ entries (node-path-host-
  delimiter) and duplicate Path/PATH casings fight each other
  (env-path-vs-PATH-casing).


---


# A '.' entry on PATH lets the repo you just opened execute its own npm

## Symptom

A tool spawns `npm` on Windows. In most directories it runs the real npm. In
one particular cloned repo, it runs... something else. Nothing errored; the
attacker-controlled `npm.cmd` in the repo root simply won.

## Repro

```
PATH=.;C:\Program Files\nodejs\
cd C:\cloned\evil-repo    # contains npm.cmd
npm --version              # executes .\npm.cmd — the repo's file
```

## Cause

cmd.exe (and resolution that mimics it) walks every PATH entry in order,
including relative entries like `.`. A leading dot entry makes the CURRENT
DIRECTORY the highest-priority tool source — so opening a repository is
equivalent to prepending that repository to PATH.

## Workaround

- When resolving commands for spawn, skip relative PATH entries and the exact
  cwd (but not legitimate home-subtree entries like %AppData%\npm — the
  referenced fix threads that needle).
- Defense in depth: resolve to absolute paths once, then spawn the absolute path.


---


# A sibling .exe silently beats your .cmd shim — PATHEXT rank order

## Symptom

A wrapper that rewrites `tool.cmd` works for months. Then an updater drops
`tool.exe` in the SAME directory and every invocation silently bypasses the
wrapper — no error, just the unwrapped binary running.

## Repro

```powershell
$env:PATHEXT   # .COM;.EXE;.BAT;.CMD;...  ← .EXE outranks .CMD
# dir with both tool.exe and tool.cmd → "tool" resolves to tool.exe, always.
```

## Cause

PATHEXT is an ordered list. Extensionless resolution tries `.COM`, then
`.EXE`, then `.BAT`/`.CMD` — within the same PATH entry. A shim strategy that
only owns the `.cmd` name is one updater run away from being invisible.

## Workaround

- Shim ALL launchable siblings (or rename/refresh the `.exe` too, as the
  referenced fix does).
- Detection: after installing a shim, resolve the bare name again and verify it
  lands on your shim.


---


# Installed a tool, still 'not found' — your session's PATH is a snapshot

## Symptom

An installer runs `winget install node` (or similar), the install succeeds, and
the very next line — `node --version` — fails with "not recognized". The user
opens a NEW terminal and it works. Agents retry the install in a loop.

## Repro

```powershell
winget install OpenJS.NodeJS ; node --version
# 'node' is not recognized as the name of a cmdlet...
# New terminal: node --version → works.
```

## Cause

Installers write PATH to the REGISTRY (Machine/User scope). `$env:Path` is a
process-creation snapshot of that merge — it never refreshes itself. Everything
the current session spawns inherits the stale copy, so the just-installed tool
is invisible until a new process re-reads the registry.

## Workaround

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')
```

Re-merge from the registry after any install step (the referenced installer does
exactly this between winget and the first node call). Scope-read before writing,
per envpath-pollutes-user — the two traps are mirror images.


---


# An extensionless shim on PATH is invisible to Windows spawn — ENOENT with the file right there

## Symptom

A test fixture (or dotfiles setup) drops an extensionless shebang script named
`codex` into a PATH directory — the POSIX way. Windows spawn returns ENOENT.
The file exists, is on PATH, and chmod 755 "succeeded" (a no-op on NTFS).

## Repro

```js
// binDir/codex  (#!/bin/sh script, no extension), binDir on PATH:
spawnSync("codex");        // ENOENT — never a candidate
```

## Cause

CreateProcess/PATHEXT resolution only tries the extensions in PATHEXT
(.COM;.EXE;.BAT;.CMD;...). An extensionless file is not in the candidate set at
all — there is no execute bit to save it, because NTFS ignores POSIX modes.
Distinct from npm-ps1-not-comspec (a WRONG shim wins) and pathext-exe-beats-cmd
(rank order): here NOTHING PATHEXT-legal exists, so resolution finds nothing.

## Workaround

- Ship .cmd (or .exe) alongside any extensionless POSIX shim when Windows is a
  target; fixtures must create platform-appropriate shims.
- Diagnosis rule: "ENOENT but the file is right there on PATH" on Windows =
  check the extension against PATHEXT first.
