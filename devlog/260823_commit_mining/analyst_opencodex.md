All 46 SHAs classified from `git show` in `/Users/jun/Developer/new/700_projects/opencodex`. Merge commits used first-parent diffs (plain `git show` is empty).

0757b10e8f | REF-APPEND:windowstyle-hidden-vs-windowshide | Merge of #1347: same popup fix as 93a083d1fc — trusted `powershell.exe` + `windowsHide` because `-WindowStyle Hidden` still allocates a console.
0a90477616 | NEW-LANDMINE | Strips `"-WindowStyle","Hidden"` from every direct PowerShell argv; comments that Bun 1.3.14 fails that CLI pair before the command runs (#1589); keeps `windowsHide: true`.
0deda7caff | REJECT:Windows UAC/schtasks flow | One elevated create+run; `$p.Handle` / `exit $null`→0 comment is relocated pre-existing 5.1 workaround, not a new trap fix.
12d0c34d2e | REJECT:GUI feature | Models-tab Codex staleness banner; no PowerShell.
13a76a38a9 | REJECT:Windows MAX_PATH/Run-key | HKCU Run entry shortened via VBS host; PS command only moves into the VBS body.
18cf8435f7 | REJECT:WSL dual-install | Doctor/shim guards for WSL+Windows Codex homes; no PS semantics.
19afd9e37b | REF-APPEND:ps51-no-and-and | Host-shell-neutral recovery: POSIX `cat`/`ls`/`rg` vs PS `Get-Content`/`Get-ChildItem`/`Select-String` so agents do not replay bash through 5.1.
2435836dd0 | REF-APPEND:windowstyle-hidden-vs-windowshide | Adds `windowsHide` (and `-WindowStyle Hidden`) on PowerShell CIM cmdline probes to stop console flashes; also non-PS port pinning / icacls hide.
2ade543633 | REJECT:shim env scoping | Scopes Bun provenance env around `ensure` in the pwsh shim; `exit $LASTEXITCODE` / `*> $null` already present.
355640da90 | REJECT:docs-only | Plan note to reuse `resolveTrustedWindowsPowerShellExe` in the USERDOMAIN ACL write-up.
356ae7b0a7 | REJECT:Windows-but-not-PS | Readiness skips WMIC/PowerShell pid verification for latency, not a language trap.
393d72a779 | REF-APPEND:bun-ps-windowstyle-argv | `src/service.ts` wrapper-killer drops the same Bun-rejected `-WindowStyle Hidden` argv pair; sweep test forbids it in `src/**/*.ts`.
39b0eeedaa | REJECT:docs-only | Windows stability program unit, including `010_windowstyle_argv.md` recording F1; no runtime fix.
4368bb3520 | REJECT:Windows ARM64 path/FFI | Types/rethrows trusted PowerShell resolution failure; not USERDOMAIN or PS syntax.
4ff8456e4a | REJECT:test-infra | Injects an async CIM/PowerShell runner so enumeration tests have an oracle off Windows.
627eecf6ef | REJECT:Windows PATH/System32 | `icacls.exe` resolved via GetSystemDirectoryW, not `$env:USERDOMAIN` principal construction.
6ec6ffc755 | REJECT:test-infra | Live CIM enumeration test tolerates one thrown deadline.
751dd8e4f7 | REJECT:Windows stop/restart | Backend-aware stop still spawns PowerShell with `-WindowStyle Hidden` (landmine not removed here).
760b287bc5 | REF-APPEND:curl-alias | Replaces Windows `curl \| bash` install guidance with `irm 'https://cli.kiro.dev/install.ps1' \| iex` so 5.1 does not bind `curl` to Invoke-WebRequest.
76a81b060b | REJECT:unrelated | fab08a selectedSkillId / auth retry; no PowerShell.
81f3f689af | REJECT:test-infra | Widens tray test budget for a real PowerShell→Bun child; no semantic change.
8946a10261 | REJECT:test-infra | Seeds LocalApplicationData so identity PS `GetFolderPath` works in the Windows sandbox.
93406f66fb | REJECT:new installer, not a trap fix | Adds `scripts/install.ps1` (`irm bun.sh/install.ps1 \| iex`) plus taskkill/`EPERM` pid checks.
93a083d1fc | NEW-LANDMINE | Identity/CIM lookups: `-WindowStyle Hidden` does not stop a new console from a console-less parent; `windowsHide`/CREATE_NO_WINDOW does (#1236).
960c7a934e | REJECT:perf memoization | Caches per-process SID/folder PS lookups; same command.
9a6e20e6a1 | REJECT:docs-only | npm `--allow-scripts=bun` recovery text; install.ps1 comment only.
9d1bb14606 | REF-APPEND:english-and-not-separator | Merge of #505 / a00f1a4618 (`and` → `;` in the PowerShell recovery string).
a00f1a4618 | NEW-LANDMINE | Doctor recovery: `Remove-Item ... SilentlyContinue and $env:CODEX_HOME = ...` → `...SilentlyContinue; $env:CODEX_HOME = ...` so English `and` is not parsed as part of Remove-Item/`-and`.
a18acd6ad1 | REJECT:test-infra | Stops two suites from waiting on the Windows runner; no PS.
ac8c0d2dfd | NEW-LANDMINE | Elevation launcher fragments joined with `; ` split `Start-Process` so `-ArgumentList`/`-Verb` became new statements; now `.join("")` with `;` only after `-Wait`.
af1229de8e | REF-APPEND:bun-ps-windowstyle-argv | Merge of #1944 / 393d72a779 (wrapper-killer argv).
afb011f1cf | REJECT:Windows-but-not-PS | Skips non-executable `.ps1` shim backups in probe candidates.
b7b34a9ff4 | REJECT:CI timeout | Widens identity PS lookup timeout 8s→30s on GITHUB_ACTIONS only.
bcb9aaa3b8 | REJECT:unrelated | Duplicate fab08a cycle-4 patch; no PowerShell.
c55db9d9ff | REJECT:Windows PATH/System32 | `powershell.exe`/`schtasks.exe` via GetSystemDirectoryW instead of PATH/`%SystemRoot%`.
ca7923a59b | REJECT:test-infra | Portable fake-powershell.cmd/.sh oracles for #1852; no language change.
d0b5989b79 | NEW-LANDMINE | pwsh uninstall step: `schtasks /query` exit 1 (task gone) is expected, already folded into `$LASTEXITCODE`, but the step still failed until explicit `exit 0`.
d435ce3854 | REJECT:Windows UAC/timeout | Classifies cancelled Start-Process; no new PS parser/exit trap.
d44e567352 | NEW-LANDMINE | Cursor bridge guidance: PS 5.1 treats `&&`/`||` as parser errors; `;` is not `&&`; use `if ($?)` / working-directory arg; no `cd /d` or bash heredocs (#627/#604).
d55bc920db | REJECT:test-infra | Guards async CIM wirings behind #1852; test-only.
dcaede6e58 | REF-APPEND:ps51-no-and-and | Same 4-file PS 5.1 `&&`/host-shell patch as d44e567352 (other branch SHA).
e78fff1dc9 | REJECT:test-infra | Shared slow-work budget helper; mentions PowerShell only as a budget class.
ebd4cdf027 | REJECT:docs-only | Windows CI flake RCA (tray PS child, CIM).
ed0d5af35f | REJECT:docs-only | WP3 write-up (`-ErrorAction Stop` on CIM); no code.
ee7c252fcb | REJECT:docs-only | Flake taxonomy follow-on; no code.
ff6916abcd | REF-APPEND:bom-less-ps1-cp949 | Writes the `.ps1` Codex shim with `\uFEFF` because 5.1 decodes BOM-less ps1 as ANSI/CP949 and mangles non-ASCII paths.

## NEW-LANDMINE summary

**windowstyle-hidden-vs-windowshide** — category: args-quoting
PowerShell’s `-WindowStyle Hidden` does not prevent Windows from allocating a brand-new visible console when the parent process has none. A console-subsystem `powershell.exe` child still flashes unless the launcher sets CREATE_NO_WINDOW (`windowsHide: true`).
Key: [src/codex/user-identity.ts](/Users/jun/Developer/new/700_projects/opencodex/src/codex/user-identity.ts) @ 93a083d1fc lines 105–110 (`windowsHide` vs `-WindowStyle Hidden`).

**bun-ps-windowstyle-argv** — category: args-quoting
Passing `"-WindowStyle", "Hidden"` as adjacent argv to `powershell.exe` can make Bun 1.3.14 fail the spawn before `-Command` runs (#1589), so SID/process lookups and wrapper kills silently do nothing. Keep process-level `windowsHide`; do not put `-WindowStyle Hidden` on the PowerShell CLI (script-internal `Start-Process -WindowStyle Hidden` is a different construct).
Key: [src/codex/user-identity.ts](/Users/jun/Developer/new/700_projects/opencodex/src/codex/user-identity.ts) @ 0a90477616 lines 106–108; also [src/service.ts](/Users/jun/Developer/new/700_projects/opencodex/src/service.ts) @ 393d72a779 lines 2360–2366.

**english-and-not-separator** — category: args-quoting
English `and` is not a PowerShell statement separator. A pasted recovery line `Remove-Item Env:FOO -ErrorAction SilentlyContinue and $env:FOO = ...` is not two commands (`and`/`-and` bind into the first statement). Use `;` between statements.
Key: [src/codex/home.ts](/Users/jun/Developer/new/700_projects/opencodex/src/codex/home.ts) @ a00f1a4618 line 203.

**join-semicolon-splits-startprocess** — category: args-quoting
Building one `Start-Process` by `.join("; ")` of `-FilePath` / `-ArgumentList` / `-Verb` fragments inserts a statement terminator mid-command, so the elevated process starts without `-ArgumentList`/`-Verb RunAs`. Join the parameter tokens with `""` and put `;` only after the complete `Start-Process ... -Wait`.
Key: [src/lib/windows-elevation.ts](/Users/jun/Developer/new/700_projects/opencodex/src/lib/windows-elevation.ts) @ ac8c0d2dfd lines 641–656.

**ps51-no-and-and** — category: versions
Windows PowerShell 5.1 does not implement pipeline-chain `&&`/`||` (those are 7+); they are parser errors, which makes agents loop when told to “retry the same command.” `;` runs the next statement unconditionally, so it is not a substitute; gate with `if ($?)` (or a working-directory argument) and never replay CMD `cd /d` or bash heredocs.
Key: [src/adapters/cursor/native-exec-shell.ts](/Users/jun/Developer/new/700_projects/opencodex/src/adapters/cursor/native-exec-shell.ts) @ d44e567352 line 36.

**pwsh-leaks-lastexitcode** — category: exit-codes
A native command’s `$LASTEXITCODE` becomes the pwsh process/CI-step exit even after you handled it. `schtasks /query` returning 1 when the task is gone is success for uninstall, but without a final `exit 0` GitHub Actions `shell: pwsh` still fails the step. Distinct from “`$?` lies — read `$LASTEXITCODE`”: here `$LASTEXITCODE` was read correctly and still leaked.
Key: [.github/workflows/service-lifecycle.yml](/Users/jun/Developer/new/700_projects/opencodex/.github/workflows/service-lifecycle.yml) @ d0b5989b79 lines 129–135.
