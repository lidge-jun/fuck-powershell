11개 모두 분류했습니다. 코드로 우회한 PS 함정만 NEW/REF로 남기고, Windows spawn·문서 언급은 REJECT입니다.

## Per-commit

1442bd1f | NEW-LANDMINE | adds `scripts/install-windows.ps1` (and Pages copy) invoked as `irm … \| iex` / `powershell -ExecutionPolicy Bypass -File`; after winget reloads `$env:Path` from Machine+User registry; native `npm` is `& npm … 2>&1` then `$LASTEXITCODE -ne 0` under `$ErrorActionPreference='Stop'`
208f7590 | REJECT: docs-only FAQ backtick markup; PowerShell 5.1 is only an inline-code mention
43a935f9 | REF-APPEND:actions-default-shell | `.github/workflows/ci.yml` adds `shell: bash` to a POSIX `if [ "$WANT" != "$ACTUAL" ]` SHA gate because windows-latest defaults to pwsh and could not parse it
5cfb9cbb | REJECT: test-infra Node glob runner for bash/pwsh/cmd (`tests/**/*.test.js`); not a PS-semantic fix
a14cdd7f | REJECT: Windows Node `spawn("npx", …, {shell:true})` so `.cmd` shims run via cmd.exe; CreateProcess/.cmd, not PS language semantics
b248b333 | REJECT: docs-only FAQ UI; labeled copyable `irm … \| iex` block, no PS workaround in code
b968cc58 | REJECT: Windows Node absolute `progrok.cmd` + `shell:true` because cmd.exe PATH lookup missed the shim; Windows spawn, not PS semantics
e1828b43 | REJECT: docs-only research note; `\r`/drive-letter/taskkill inventory plus execution-policy called out as not our bug
e59b6549 | REJECT: WSL `powershell.exe -NoProfile -Command Start-Process` URL handoff, USERPROFILE test isolation, win32 SIGINT; Windows/WSL interop + test-infra
f7a0c9d8 | REJECT: refactor deleting duplicate `scripts/install-windows.ps1`; Pages copy kept, no new PS semantics
58fca581 | REJECT: docs-only skill notes (`NUL` vs `/dev/null`, `$env:VAR`, `Get-ChildItem`/`schtasks`); mere cross-platform mention

## NEW-LANDMINE summary

### execution-policy
- category: ci-agents
- trap: Windows PowerShell will not `-File` a downloaded/unsigned `.ps1` under the default Restricted/RemoteSigned policy (`PSSecurityException`). The usual distribution workaround is in-memory `irm … | iex`, or an explicit `powershell -ExecutionPolicy Bypass -File`.
- key file+line: [scripts/install-windows.ps1](https://github.com/lidge-jun/ima2-gen/blob/1442bd1fa555ebda0db9b2a4a86f48ab504fd122/scripts/install-windows.ps1) lines 4–7 (`irm | iex` and `-ExecutionPolicy Bypass`) in ima2-gen 1442bd1f

### session-path-stale
- category: env-paths
- trap: `winget` (and similar installers) write Machine/User `Path` in the registry; the current PowerShell process keeps the old `$env:Path` snapshot, so a just-installed `node` is still “not found.” The installer rereads Machine+User Path into `$env:Path` before continuing.
- key file+line: same `scripts/install-windows.ps1` lines 33–34 (`[System.Environment]::GetEnvironmentVariable('Path', 'Machine'|'User')`) in ima2-gen 1442bd1f

Note: 1442bd1f also checks `$LASTEXITCODE` after native npm (existing exit-code-vs-dollar-q) and still does `2>&1` under `Stop` (existing native-stderr-errorrecord hazard, not a workaround). Those are extra evidence for the seed cases, not extra new ids.
