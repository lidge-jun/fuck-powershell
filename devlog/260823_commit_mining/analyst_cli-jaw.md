46/46 unique SHAs classified. New landmines below are the distinct PowerShell traps that are not already in the ten existing cases.

00c171e15 | REJECT:docs/ci-infra | Adds Windows/WSL platform-kind CI + docs; no PowerShell semantic change.
0e576b2ce | REF-APPEND:irm-iex-kills-host | Hardens #368 tests so `exit N`/`exit $code` cannot hide, and actually runs -File / PATH / Restricted-policy scenarios.
0efd755ed | NEW-LANDMINE:ps-file-extension-dispatch | Downloads the uv installer as `.ps1` because `powershell -File` dispatches on extension and refuses a `.sh` temp file.
19cbb01ef | REF-APPEND:irm-iex-kills-host | Pins install.ps1 hardening (throw vs exit, npm.cmd not npm.ps1, User PATH, jaw.cmd) in the default suite.
1f500fe5b | REJECT:windows-but-not-PS-semantics | Wires opt-in Node/Git bootstrap into install.ps1; download/hash/arch logic, not a PS language trap.
222b83a10 | REJECT:ci-infra | Makes the publish gate read installer-sensitive paths from the workflow so install.ps1 edits cannot skip CI.
2e83b632a | REJECT:submodule-pointer | officecli gitlink bump only; no local PowerShell diff.
322ac1801 | REF-APPEND:ps51-vs-7-split | Adds windows-native job that actually runs install.ps1 under `shell: pwsh`.
380e26346 | NEW-LANDMINE:npm-ps1-not-comspec | Rejects npm’s `.ps1` shim as unspawnable via ComSpec and ranks `.exe` > `.cmd` > `.ps1` > extensionless POSIX shim.
3d198e2b8 | NEW-LANDMINE:dq-regex-interpolates | Fixes a double-quoted `-match` regex so `$entries` is not expanded under Set-StrictMode; backslash is not an interpolation escape in PowerShell.
3e4cf7f17 | REF-APPEND:irm-iex-kills-host | Squash-promote of #368 plus Write-Host-vs-success-stream capture; not a first-party unique trap.
4f7d8ad0f | REJECT:docs-only | README adds `$env:JAW_SAFE="1"; npm install -g cli-jaw` with no installer semantics.
514f9a9cd | NEW-LANDMINE:irm-iex-kills-host | Replaces `exit 1` with `throw` so `irm \| iex` fails catchably without killing the caller host; also prefers npm.cmd, User PATH, jaw.cmd.
51afe8434 | REJECT:line-endings-infra | Normalizes install-ps1-contract.ps1 to canonical CRLF after a dirty-checkout; not a PS runtime trap.
58e60031a | REJECT:docs-only | README renderer interpolates preferredPath/registeredService; no PS semantics.
5fe703a73 | NEW-LANDMINE:strictmode-missing-property | Probes `$manifest.PSObject.Properties.Name` before `$entry.tag` / `$entry.artifacts.$arch` so Set-StrictMode does not throw PropertyNotFoundException.
6b4e26f96 | REJECT:windows-but-not-PS-semantics | TS bootstrap planner (hash, PATH merge, native arch); no PowerShell language change.
6cf7c09ee | REJECT:test-infra | Flips SAF-004k so CI must exercise install.ps1; no PS trap.
7052c0c37 | REJECT:release-chore | v2.17.6 promote of publish/promote scripts; no PS landmine in this SHA’s tree.
766bdb38e | REJECT:windows-but-not-PS-semantics | Cross-platform Windows/WSL plumbing; uv hint is `irm \| iex` but no distinct PS trap is fixed.
767132683 | REF-APPEND:dq-regex-interpolates | Same double-quoted `$entries` regex bug, plus comment-vs-string stripping for the `exit` detector.
771531124 | REF-APPEND:oss-native-arg-quoting | AGENTS.md records `#296`: PowerShell strips inner quotes from `--commands '<json>'`; code change is the bash officecli 404 guard.
7f0c655be | REF-APPEND:bom-less-ps1-cp949 | Prepends UTF-8 BOM to install.ps1 / install-officecli.ps1 and documents CP949 + nested-shell expansion in agent prompts.
8c72d7568 | REF-APPEND:native-stderr-errorrecord | Relaxes `$ErrorActionPreference` around an expected `-File` failure so 5.1 NativeCommandError does not abort the test.
98bd4aa4b | REF-APPEND:ps51-vs-7-split | Detects pwsh vs powershell.exe vs Git Bash vs cmd and invokes PS with `-File`.
9c54064c9 | REJECT:windows-but-not-PS-semantics | First officecli.ps1 (IWR download, `exit 1`); no distinct new trap beyond later BOM/irm work.
a01d3b04f | NEW-LANDMINE:command-v-noop | skills_ref bump replacing `command -v officecli`; `command` is not a PowerShell builtin, so a working install reads as missing.
a09dc4ab6 | REF-APPEND:npm-ps1-not-comspec | Keeps `.ps1` rejected even when PATHEXT lists it; PATHEXT associations work for other extensions, not for ComSpec+`.ps1`.
a5d9aa927 | REJECT:docs-only | Syncs native Windows guidance across four READMEs.
a967f0ba4 | REJECT:windows-but-not-PS-semantics | Duplicate of 9c54064c9 on another line (same officecli.ps1 intro; only build-local binaries differ).
b1b2a8efc | REJECT:submodule-pointer | officecli gitlink bump only.
b3bd71f24 | REJECT:windows-but-not-PS-semantics | Node CVE-2024-27980: execFile of npm.cmd is EINVAL; wrap via cmd.exe. Windows/Node, not PS.
ba1c15795 | REF-APPEND:command-v-noop | Documents the three agent hazards: BOM-less .ps1, `command -v` silent no-op, and inline-JSON quote stripping.
beeff7cd9 | REJECT:windows-but-not-PS-semantics | postinstall-guard looks for tsc / tsc.cmd / tsc.ps1 then execFileSync; later proven to be the .bin-shim trap, not a PS language bug.
c38c3f527 | REJECT:merge-commit | Merge of origin/main into dev; no unique landmine of its own.
c689c444a | REJECT:windows-but-not-PS-semantics | Native-Windows release gates: npm.cmd EINVAL, `.bin/tsx` is bash, path.sep, CRLF compare. Windows/Node, not PS.
c7f128491 | REF-APPEND:strictmode-missing-property | Promote that carries the #381 strict-mode manifest probes + PATH persistence into main.
cb9a4b999 | REF-APPEND:npm-ps1-not-comspec | Direct CreateProcess launch only for `.exe`/`.com`; `.ps1`/`.js`/`.vbs` return null so they keep the interpreter fallback.
d106d4278 | REJECT:windows-but-not-PS-semantics | Same native-Windows release-gate fix as c689c444a (content-identical aside from package.json versions).
dccabcd05 | REF-APPEND:ps51-vs-7-split | Runs Windows-critical suites on windows-2022 and keeps both `shell: pwsh` and `shell: powershell` installer-contract gates.
e07b8eecd | REF-APPEND:irm-iex-kills-host | Failure-path contract now uses `-NoBootstrap` + scriptblock invoke so throw-vs-exit is still the property under test.
e9d977964 | REJECT:docs-only | Generates the README Windows block from a contract JSON.
eeb2a466d | REJECT:test-infra | Gates officecli.ps1 tests to Windows (`encodedPowerShell` UTF-16LE already existed; this SHA only skips off-Windows).
ef37baf6e | REJECT:docs-only | Same README PowerShell `$env:JAW_SAFE` variant as 4f7d8ad0f (tree differs only by build-local binaries).
f0020c663 | NEW-LANDMINE:envpath-pollutes-user | First install.ps1 prints `SetEnvironmentVariable('Path', $env:Path + ';…', 'User')`, which copies Machine PATH into User PATH.
fd15f93b7 | REF-APPEND:irm-iex-kills-host | Fail-closes the -File exit-code check and actually executes the PATH-guidance branch without `-Prefix`.

---

NEW-LANDMINE summary

1. id: `irm-iex-kills-host`  
   category: exit-codes  
   Trap: Under `irm … | iex`, `exit 1` terminates the caller’s interactive host, not just the script. A catchable `throw` lets `-File` still return non-zero while the documented one-liner stays survivable.  
   Key file+line: [scripts/install.ps1](/Users/jun/Developer/new/700_projects/cli-jaw/scripts/install.ps1) `Stop-Install` (`throw "CLI-JAW installation failed…"`) in 514f9a9cd.

2. id: `npm-ps1-not-comspec`  
   category: aliases  
   Trap: npm writes `tool`, `tool.cmd`, and `tool.ps1`. Get-Command / PATHEXT can select `npm.ps1`, which Restricted/RemoteSigned blocks and which cmd.exe cannot run. Prefer `npm.cmd` / `-CommandType Application`, and never treat `.ps1` as CreateProcess-launchable.  
   Key file+line: [src/core/cli-detect.ts](/Users/jun/Developer/new/700_projects/cli-jaw/src/core/cli-detect.ts) `.PS1` rejection in 380e26346; installer `Resolve-CommandPath @('npm.cmd','npm.exe','npm')` in 514f9a9cd.

3. id: `envpath-pollutes-user`  
   category: env-paths  
   Trap: `$env:Path` is the merged process PATH (User+Machine). Writing `$env:Path + ';new'` into the User target permanently copies Machine entries into User PATH. Read `[Environment]::GetEnvironmentVariable('Path','User')` and append only the missing entry.  
   Key file+line: [scripts/install.ps1](/Users/jun/Developer/new/700_projects/cli-jaw/scripts/install.ps1) original `$env:Path + ';$globalBin'` guidance in f0020c663, replaced in 514f9a9cd.

4. id: `command-v-noop`  
   category: aliases  
   Trap: `command -v` is not a PowerShell builtin or cmdlet. It prints nothing, sets no exit code, and raises no error, so a tool that is on PATH is reported missing. Use `Get-Command <tool> -ErrorAction SilentlyContinue` or `<tool> --version`.  
   Key file+line: [AGENTS.md](/Users/jun/Developer/new/700_projects/cli-jaw/AGENTS.md) Windows shell hazards in ba1c15795; skills_ref bump a01d3b04f.

5. id: `ps-file-extension-dispatch`  
   category: args-quoting  
   Trap: `powershell -File` / `pwsh -File` dispatch on the filename extension. A downloaded installer saved as `*.sh` is refused even when the contents are PowerShell. The temp suffix must be `.ps1` when the launcher is PowerShell.  
   Key file+line: [bin/postinstall.ts](/Users/jun/Developer/new/700_projects/cli-jaw/bin/postinstall.ts) `suffix = install.shell === 'powershell' ? 'ps1' : 'sh'` in 0efd755ed.

6. id: `dq-regex-interpolates`  
   category: args-quoting  
   Trap: PowerShell interpolates `$var` inside double-quoted strings and does not treat `\` as an escape. A `-match "…($entries…"` regex expands `$entries` at construction time and dies under Set-StrictMode. Single-quote regexes that mention PowerShell variables.  
   Key file+line: [tests/windows/install-ps1-contract.ps1](/Users/jun/Developer/new/700_projects/cli-jaw/tests/windows/install-ps1-contract.ps1) `'SetEnvironmentVariable\(''Path'', \(\$entries -join'` in 767132683 / 3d198e2b8.

7. id: `strictmode-missing-property`  
   category: versions  
   Trap: `Set-StrictMode -Version Latest` throws `PropertyNotFoundException` on a missing note-property (`$entry.tag`, `$entry.artifacts.$arch`) instead of yielding `$null`. Probe `$obj.PSObject.Properties.Name -contains 'key'` before dereference.  
   Key file+line: [scripts/install.ps1](/Users/jun/Developer/new/700_projects/cli-jaw/scripts/install.ps1) `PSObject.Properties.Name` probes in 5fe703a73.

Notes for the parent: `native-stderr-errorrecord`, `bom-less-ps1-cp949`, `oss-native-arg-quoting`, and `ps51-vs-7-split` already cover the stderr-Stop, BOM, JSON-quoting, and pwsh-vs-5.1 CI work, so those commits are REF-APPEND. Node `execFile(npm.cmd)` EINVAL / `.bin` POSIX shims are Windows+Node, not PowerShell, and were rejected.
