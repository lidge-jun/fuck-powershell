# 020 — Seed cases (wp2 second half) — REV2 after fail-audit

Schema rev2: 7 categories (aliases, args-quoting, streams, encoding, exit-codes,
versions, env-paths); + source, + repro; versions quoted; no body Refs section.
All refs are public URLs (cli-jaw/opencodex are public repos — blob URLs allowed).

First-party (evidence: jun's own devlogs/incidents, refs point to public repos where shipped):

1. curl-alias.md — aliases / 5.1 / misleading-error / [agent, ci, script]
   curl → Invoke-WebRequest alias; -s/-o flags reinterpreted; agent API calls fail with
   parameter-binding errors. Workaround: curl.exe or Invoke-RestMethod explicitly.
   Refs: https://github.com/PowerShell/PowerShell/pull/1901 (removal attempt, closed
   unmerged for 5.1 compatibility; aliases were later dropped on non-Windows PS Core,
   but Windows PowerShell 5.1 keeps them forever — verified state=closed, merged=null).
2. dev-null-redirect.md — streams / both / hard-error / [ci, script, agent]
   \`> /dev/null\` creates a literal file or fails; Windows CI dies. Workaround: \`| Out-Null\`
   or \`2>$null\` or redirect to $null.
   Refs: https://github.com/adourish/robodog/commit/ecdc052ffbb3cede9526ae7001d21acf8f8f7f8b
3. native-stderr-errorrecord.md — streams / 5.1 / misleading-error / [script, ci]
   5.1 wraps native stderr in NativeCommandError when redirected; successful commands
   look failed. Evidence: cli-jaw install.ps1:105 mitigation +
   https://github.com/dqfront/NousResearch-hermes-agent/commit/ec1714e71f90691e1cf412796e9a4b4ba0d934f4
4. ps51-vs-7-split.md — versions / both / silent / [script, ci]
   #Requires -Version 5.1 contract, powershell vs pwsh, utf8NoBOM unavailable in 5.1.
   Refs: https://github.com/parsaesmaili038/ticketing-v1/commit/d5a4d513e34d557f345b41d9e1b9fdd2806d4a04
5. env-domain-principal.md — env-paths / both / hard-error / [script]
   REFRAMED: "\$env:USERDOMAIN is not identity." On a workgroup machine USERDOMAIN holds
   the computer name; building an icacls/DACL principal from it fails on renamed
   machines, Microsoft-account logins, AzureAD joins. PS-native repro: compare
   \$env:USERDOMAIN vs [System.Security.Principal.WindowsIdentity]::GetCurrent().
   Fix pattern: SID principal (*S-1-5-21-...). Ref (public blob):
   https://github.com/lidge-jun/opencodex/blob/main/src/lib/windows-secret-acl.ts
6. exit-code-vs-dollar-q.md — exit-codes / both / silent / [script, ci, agent]
   $? vs $LASTEXITCODE; native failure ignored; PS<7.4 no PSNativeCommandUseErrorActionPreference.
   Refs: https://github.com/PowerShell/PowerShell/pull/10461

6b. bom-less-ps1-cp949.md — encoding / "5.1" / silent / [script, agent]  (REPLACES the
   cut shim-arg-scan case)
   PowerShell 5.1 reads a BOM-less .ps1 as the ANSI code page (CP949 on Korean hosts),
   corrupting non-ASCII literals BEFORE execution; garbled output proves nothing, only
   byte-length checks do. Ref (public blob):
   https://github.com/lidge-jun/cli-jaw/blob/main/src/prompt/templates/a1-system.md

Third-party (oss- prefix, commit URL mandatory):

7. oss-native-arg-quoting.md — args-quoting / both / silent / [script, agent]
   Embedded quotes/empty args lost in native invocation; PSNativeCommandArgumentPassing
   introduced in 7.2. Refs: https://github.com/PowerShell/PowerShell/pull/14692 +
   https://github.com/PowerShell/PowerShell/pull/15408 (Windows legacy carve-out).
8. oss-outfile-bom.md — encoding / 5.1 / silent / [ci, script]
   Out-File default UTF-16LE/BOM corrupts files consumed by POSIX tools.
   Refs: https://github.com/parsaesmaili038/ticketing-v1/commit/d5a4d513e34d557f345b41d9e1b9fdd2806d4a04

Audit deltas applied (auditor near-pass, 260822): full owner/repo commit URLs recorded;
PR #1901 wording corrected to closed-unmerged (verified via gh api: state=closed,
merged=null); fnm PR #1570 dropped as evidence (open unmerged installer PR — weak).
Lint doc note: versions enum values are quoted strings ("5.1"), YAML float trap documented.

8 seeds total ≥ 6 required; 2 oss- ≥ 2 required.
