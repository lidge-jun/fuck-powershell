
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
