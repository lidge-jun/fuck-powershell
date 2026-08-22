---
name: powershell-landmines
description: "Query-first Windows failure intelligence: preflight the fuck-powershell landmine corpus before patches, and avoid PowerShell landmines when writing or running Windows shell commands: alias traps (curl/wget), POSIX redirects (/dev/null), native stderr ErrorRecord wrapping, exit-code blindness, encoding/BOM corruption, 5.1-vs-7 divergence, quoting loss, env-var identity traps. Use BEFORE generating any powershell/pwsh command, .ps1 script, or Windows CI step. Triggers: PowerShell, pwsh, powershell.exe, .ps1, Windows shell, Windows CI, icacls, Invoke-WebRequest, 파워쉘, 윈도우 스크립트."
metadata:
  short-description: "PowerShell landmine avoidance rules + case references"
---

# powershell-landmines

Windows shell & process interoperability hazards for coding agents — backed by the
fuck-powershell failure corpus (https://github.com/lidge-jun/fuck-powershell,
live: https://lidge-jun.github.io/fuck-powershell/). PowerShell is the brand;
the corpus covers cmd.exe, Node/Bun spawn, PATH/PATHEXT, encodings, Win32 paths,
and CI runner behavior.

## Dynamic lookup (preferred)

Pull the corpus once, then QUERY BEFORE PATCHING:

```
git clone https://github.com/lidge-jun/fuck-powershell ~/.fuck-powershell
```

Before modifying code that touches Windows process execution, PowerShell/cmd
scripts, PATH/env, encodings, exit codes, or Windows CI steps, run a preflight:

```
bun ~/.fuck-powershell/scripts/fp.mjs preflight --runtime node --operation spawn --target npm --json
bun ~/.fuck-powershell/scripts/fp.mjs preflight --runtime powershell --operation encoding
```

operations: spawn | env-path | encoding | redirect | exit-code | quoting | install | ci.
Read the top cases it returns (`fp case <id>`) and apply their constraints.
After generating a diff, postflight risky tokens: `fp search "<tokens from diff>"`
and `fp errors <enoent|einval|eperm|...>` when an error signature appears.
risk: high means read the top case BEFORE writing code; medium means scan titles.
The graph is rebuilt automatically on first query; `git -C ~/.fuck-powershell pull` to update.

## Core rules (fallback when the corpus is not installed)

1. Never use bare `curl` or `wget` — on Windows PowerShell 5.1 they are aliases of
   `Invoke-WebRequest`. Use `curl.exe` or `Invoke-RestMethod`. Never probe with
   `command -v` (silent no-op) — use `Get-Command`. Never resolve npm tools to
   their `.ps1` shim — prefer `.cmd`/`.exe`.
2. Never redirect to `/dev/null` — use `$null` (`2>$null`, `*> $null`) or `Out-Null`.
3. Check native failures with `$LASTEXITCODE`, not `$?` or try/catch. On 7.4+ you
   may set `$PSNativeCommandUseErrorActionPreference = $true`. In `shell: pwsh` CI
   steps, end expected-failure branches with explicit `exit 0` (the last native
   exit code leaks into the step result). In `irm | iex` scripts, fail with
   `throw`, never `exit` — exit kills the user's terminal.
4. Do not combine `2>&1` with `$ErrorActionPreference='Stop'` around native
   commands on 5.1 — stderr lines become fatal ErrorRecords.
5. Always pass an explicit `-Encoding` when writing files. 5.1 `Out-File`/`>`
   default to UTF-16LE+BOM; 7 defaults to BOM-less UTF-8.
6. Any .ps1 you generate that contains non-ASCII MUST be saved UTF-8 **with BOM**,
   or 5.1 parses it as the ANSI code page (CP949/CP1252) before execution.
7. Know which runtime runs your script: `powershell.exe` is 5.1, `pwsh` is 7.
   In GitHub Actions, `shell: powershell` != `shell: pwsh`. Pin deliberately.
   5.1 has NO `&&`/`||` — gate with `if ($?)`; the word `and` is never a
   separator; a `;` between fragments of ONE call splits it into broken statements.
8. Do not pass inline JSON or empty-string args to native commands on 5.1/7.0;
   quoting is rebuilt heuristically. Use files/stdin, or pin
   `$PSNativeCommandArgumentPassing = 'Standard'` on 7.2+.
9. Never build a security principal from `$env:USERDOMAIN`/`$env:USERNAME` — use
   the token SID: `[Security.Principal.WindowsIdentity]::GetCurrent().User.Value`.
   Never write `$env:Path` (merged view) into User PATH — read the 'User' scope and
   append only the missing entry. After installers, re-merge `$env:Path` from the
   Machine+User registry scopes (the session snapshot is stale).
10. Probe commands with `Get-Command`, not `command -v`; prefer a script file over
    a deep quoted one-liner; verify encodings by bytes, never by console rendering.

## References (full cases with repro + citations)

| file | covers |
|---|---|
| references/aliases.md | command-v-noop, curl-alias, get-command-where-disagree, npm-ps1-not-comspec, spawn-npm-enoent-einval |
| references/streams.md | dev-null-redirect, native-stderr-errorrecord, out-string-multiplies-stderr, write-host-not-success-stream |
| references/encoding.md | bom-less-ps1-cp949, oss-outfile-bom, tee-object-utf16, utf8-bom-still-breaks-grep |
| references/exit-codes.md | exit-code-vs-dollar-q, explorer-exits-one, if-nativecmd-truthiness, irm-iex-kills-host, pwsh-leaks-lastexitcode, start-process-no-lastexitcode |
| references/args-quoting.md | backslash-quote-ends-span, bun-ps-windowstyle-argv, cmd-shim-reparses-argv, cmd-start-ampersand-splits, dollar-backslash-vars, dq-regex-interpolates, english-and-not-separator, join-semicolon-splits-startprocess, oss-native-arg-quoting, piped-iex-drops-params, prose-as-unknown-flags, ps-file-extension-dispatch, windowstyle-hidden-vs-windowshide |
| references/versions.md | ps51-no-and-and, ps51-vs-7-split, strictmode-missing-property |
| references/env-paths.md | env-domain-principal, env-path-vs-PATH-casing, envpath-pollutes-user, node-path-host-delimiter, path-colon-not-delimiter, path-dot-hijacks-bare-npm, pathext-bare-name-enoent, pathext-exe-beats-cmd, session-path-stale, test-path-trailing-whitespace, windowsapps-alias-eperm |
| references/ci-agents.md | actions-default-shell, cmd-posix-env-prefix, execution-policy-file-block |
| references/collections.md | get-content-scalar-collapse, ne-filters-instead-of-compares, return-does-not-mean-return |
| references/parsing.md | convertto-json-depth-two, culture-comma-decimal-cast |

Read the matching reference before writing code in that risk area. Each case is
Symptom / Repro / Cause / Workaround with public commit/PR citations.
