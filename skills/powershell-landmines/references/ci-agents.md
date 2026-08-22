
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


---


# your npm script is a bash one-liner everywhere and a literal filename on Windows, so the release silently ships without its Windows artifact

## Symptom

A `package.json` script that has worked for years fails only on the Windows leg of
a release matrix, and the error names a file nobody wrote:

```
PYTHON: cannot open file D:\a\proj\proj\=$(bash ../scripts/pick-python.sh)
```

The path is your command substitution, verbatim, treated as a filename. Because
the macOS and Linux legs still pass, the release itself reports success and only
the Windows artifact goes missing — sometimes for several versions before anyone
notices.

## Repro

```json
{ "scripts": { "build": "node $(node -p \"'app.js'\")" } }
```

```
PS> npm run build
Error: Cannot find module 'D:\proj\$(node'
```

```
$ npm run build     # macOS / Linux — runs app.js
```

The substitution is neither expanded nor rejected: its literal text becomes an
argument. That is what makes the real-world version confusing, because the
complaint comes from whatever program received the text:

```
PYTHON: cannot open file D:\a\proj\proj\electron\=$(bash ../scripts/pick-python.sh)
```

There `PYTHON="$(bash ...)"` was meant as an environment prefix. Nothing expanded,
so `PYTHON` resolved through PATHEXT to `python.exe` and the remainder of the line
arrived as a filename to open.

## Cause

npm does not run scripts in a shell of your choosing. On POSIX it uses `/bin/sh`;
on Windows it uses cmd.exe. POSIX shell features you use without thinking are
simply absent there:

- `$(...)` command substitution — not expanded, passed through as text.
- single quotes as a quoting mechanism — cmd.exe treats them as literal characters.
- `VAR=value cmd` inline environment prefixes — that one has its own case,
  `cmd-posix-env-prefix`. It compounds with this one: a prefix whose value is a
  substitution fails on both counts at once, which is exactly the release-lane
  failure above.

Which interpreter you get is npm's `script-shell` config, and its Windows default
is cmd.exe specifically — not `%ComSpec%`. Repointing ComSpec at PowerShell does
not change `npm run`; only `script-shell` does. Node's own `shell: true` is the
one that follows ComSpec, which is a different trap in the same neighborhood.

What makes this a release-killer rather than an annoyance is where it lands. The
failing script is usually a per-platform `dist:win` entry that only executes on
the Windows runner, so it cannot fail during local development or in a pull
request that builds one OS.

## Workaround

Move logic out of the script string and into a file the runtime can execute
directly:

```json
{ "scripts": { "build": "node scripts/build.mjs" } }
```

Compute environment variables inside that program rather than prefixing them in
the script line. When a script genuinely must be shell, name the shell explicitly
(`"build": "bash scripts/build.sh"`) and accept the Git-Bash dependency, or set
`script-shell` in `.npmrc` — but note that changes it for every script and every
contributor.

A contract test that walks `scripts` and rejects `$(`, `&&` chains with inline
env, and single-quoted arguments costs ten lines and catches the next one at PR
time instead of release time.

---

`cmd-posix-env-prefix` covers the inline `VAR=value` prefix specifically.
`actions-default-shell` covers the CI runner's default shell. This case is the
package-manager layer between them: the script string you wrote is handed to a
different interpreter based on the host, and `npm run` never says so.
