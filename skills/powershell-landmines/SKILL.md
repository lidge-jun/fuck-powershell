---
name: powershell-landmines
description: "Avoid PowerShell landmines when writing or running Windows shell commands: alias traps (curl/wget), POSIX redirects (/dev/null), native stderr ErrorRecord wrapping, exit-code blindness, encoding/BOM corruption, 5.1-vs-7 divergence, quoting loss, env-var identity traps. Use BEFORE generating any powershell/pwsh command, .ps1 script, or Windows CI step. Triggers: PowerShell, pwsh, powershell.exe, .ps1, Windows shell, Windows CI, icacls, Invoke-WebRequest, 파워쉘, 윈도우 스크립트."
metadata:
  short-description: "PowerShell landmine avoidance rules + case references"
---

# powershell-landmines

Reproducible-case-backed rules for not stepping on PowerShell mines. Full archive:
https://github.com/lidge-jun/fuck-powershell (live: https://lidge-jun.github.io/fuck-powershell/)

## Before you run anything (10 rules)

1. Never use bare `curl` or `wget` — on Windows PowerShell 5.1 they are aliases of
   `Invoke-WebRequest`. Use `curl.exe` or `Invoke-RestMethod`.
2. Never redirect to `/dev/null` — use `$null` (`2>$null`, `*> $null`) or `Out-Null`.
3. Check native failures with `$LASTEXITCODE`, not `$?` or try/catch. On 7.4+ you
   may set `$PSNativeCommandUseErrorActionPreference = $true`.
4. Do not combine `2>&1` with `$ErrorActionPreference='Stop'` around native
   commands on 5.1 — stderr lines become fatal ErrorRecords.
5. Always pass an explicit `-Encoding` when writing files. 5.1 `Out-File`/`>`
   default to UTF-16LE+BOM; 7 defaults to BOM-less UTF-8.
6. Any .ps1 you generate that contains non-ASCII MUST be saved UTF-8 **with BOM**,
   or 5.1 parses it as the ANSI code page (CP949/CP1252) before execution.
7. Know which runtime runs your script: `powershell.exe` is 5.1, `pwsh` is 7.
   In GitHub Actions, `shell: powershell` != `shell: pwsh`. Pin deliberately.
8. Do not pass inline JSON or empty-string args to native commands on 5.1/7.0;
   quoting is rebuilt heuristically. Use files/stdin, or pin
   `$PSNativeCommandArgumentPassing = 'Standard'` on 7.2+.
9. Never build a security principal from `$env:USERDOMAIN`/`$env:USERNAME` — use
   the token SID: `[Security.Principal.WindowsIdentity]::GetCurrent().User.Value`.
10. Probe commands with `Get-Command`, not `command -v`; prefer a script file over
    a deep quoted one-liner; verify encodings by bytes, never by console rendering.

## References (full cases with repro + citations)

| file | covers |
|---|---|
| references/aliases.md | curl-alias |
| references/streams.md | dev-null-redirect, native-stderr-errorrecord |
| references/encoding.md | oss-outfile-bom, bom-less-ps1-cp949 |
| references/exit-codes.md | exit-code-vs-dollar-q |
| references/args-quoting.md | oss-native-arg-quoting |
| references/versions.md | ps51-vs-7-split |
| references/env-paths.md | env-domain-principal |
| references/ci-agents.md | actions-default-shell |

Read the matching reference before writing code in that risk area. Each case is
Symptom / Repro / Cause / Workaround with public commit/PR citations.
