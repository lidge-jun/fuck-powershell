
# GitHub Actions on Windows defaults to PowerShell — your bash-ism dies quietly

## Symptom

A workflow step that works on ubuntu-latest fails on windows-latest with baffling
errors: `&&` chains behave oddly, `export FOO=bar` does nothing, `2>/dev/null`
throws path errors, heredocs are syntax errors. Nothing in the step changed —
only the runner OS.

## Repro

```yaml
jobs:
  win:
    runs-on: windows-latest
    steps:
      - run: export MY_VAR=1 && echo "$MY_VAR" > /dev/null
      # windows-latest default shell is pwsh:
      # 'export' is not recognized / cannot find path 'C:\dev\null'
```

## Cause

On Windows runners the default `run:` shell is `pwsh` (and `shell: powershell`
selects 5.1 — a different runtime again; see the versions category). Every POSIX
idiom in the step body is suddenly PowerShell input. Coding agents make the same
mistake in reverse: they generate bash-flavored one-liners and hand them to a
Windows host whose remote shell is PowerShell. Both referenced commits are
production fixes for this class of failure — one migrating a Windows workflow to
explicit `pwsh` + encoding-safe cmdlets, one auto-translating POSIX null-device
redirects that agents kept emitting.

## Workaround

- Declare the shell per step explicitly: `shell: bash` (Git Bash exists on
  runners) or `shell: pwsh` — never rely on the default.
- Keep Windows steps PowerShell-native; do not paste POSIX one-liners.
- For agents: detect the target shell before generating commands, and load the
  powershell-landmines skill rules (rules 1-2, 7).


---


# VAR=value cmd is not cmd.exe syntax — npm scripts break on Windows

## Symptom

A package.json script like `"test": "NODE_ENV=test node run.js"` works for
every contributor — until the first Windows contributor runs it:
'NODE_ENV' is not recognized as an internal or external command.

## Repro

```
# cmd.exe (npm's default script shell on Windows):
NODE_ENV=test node run.js
# 'NODE_ENV' is not recognized as an internal or external command
```

## Cause

VAR=value cmd is POSIX per-command environment syntax. cmd.exe has no such
form — it tries to execute the literal token NODE_ENV=test as a program. npm
runs scripts through cmd.exe on Windows, so the POSIX prefix silently
platform-locks the script.

## Workaround

- Route env-setting through a tiny Node wrapper (the referenced
  run-with-env.mjs pattern) or cross-env.
- Or set variables inside the Node process; keep package.json scripts
  shell-neutral.


---


# Execution policy blocks your downloaded installer

## Symptom

A user downloads `install.ps1` and runs it. Windows PowerShell refuses:
"running scripts is disabled on this system" (PSSecurityException,
UnauthorizedAccess). The same content pasted into the terminal runs fine —
confusing everyone.

## Repro

```powershell
# Default Windows PowerShell policy is Restricted (client SKUs):
powershell -File .\install.ps1
# File ... cannot be loaded because running scripts is disabled on this system.
```

## Cause

Execution policy gates SCRIPT FILES, not commands: `-File` and `.ps1` dispatch
are blocked under Restricted/AllSigned (and unsigned downloads under
RemoteSigned via Mark-of-the-Web), while in-memory text execution is not. That
asymmetry is why installer one-liners are `irm URL | iex` — piping text into
the session bypasses file policy. It is a distribution constraint, not slop.

## Workaround

- Distribute the documented entrypoint as `irm <url> | iex` (and then follow
  irm-iex-kills-host: the script must `throw`, never `exit`).
- For local runs, `powershell -ExecutionPolicy Bypass -File install.ps1`
  scopes the override to one process — do not change machine policy.
- CI runners set Bypass for `shell: powershell/pwsh` already; this trap bites
  end-user machines, not Actions.
