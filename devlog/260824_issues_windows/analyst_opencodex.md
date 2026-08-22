All 62 SHAs classified. Report is one line per SHA, then the NEW-LANDMINE summaries.

060f51d9a6 | REJECT:Windows catalog/TOML plumbing | `src/codex-paths.ts` + catalog injection; no PS/spawn trap
08552da560 | REJECT:unrelated fabric UI | FAB-07 control-plane/projections; no Windows shell
0a207207dc | REJECT:Windows UAC/schtasks flow | scheduler install removes native service; Start-Process elevation product plumbing
0c461c6e3b | REJECT:test-infra | swaps `printf` fixtures for `node -e` and uses tmpdir; no new semantics
125156c3e1 | REJECT:Windows-but-not-PS | catalog retry TTL/unknown state; no shell trap
1330dd6a5a | REJECT:WSL dual-install | wsl.conf automount/systemd/localhost; no PS semantics
159d2ab183 | REJECT:Windows-but-not-PS | CIM discovery moved off request loop; still uses existing windowsHide
1b626e4f81 | NEW-LANDMINE | PATHEXT ranks `.EXE` over `.CMD`, so a sibling `codex.exe` silently bypasses `codex.cmd`
1cfb2e7a40 | REJECT:GUI feature | Models context-window save; no PowerShell
1ed2d7048e | REJECT:runtime/timer hang | Bun Windows unref'd timer starvation; not shell semantics
22e156e25a | REF-APPEND:bom-less-ps1-cp949 | still writes `\uFEFF` on `.ps1` shims while adding Bun provenance env
26dc5aa2b7 | REF-APPEND:windowstyle-hidden-vs-windowshide | CIM start-time lookup still passes `"-WindowStyle","Hidden"` plus `windowsHide: true`
29849bb00a | REF-APPEND:spawn-npm-enoent-einval | drops `shell:true` `.cmd` probe; routes through `commandInvocation` / ComSpec `/d /s /c`
2b71f1df4f | REJECT:Windows UAC/schtasks flow | duplicate of 0a207207dc on another branch
2d82ddfc8f | REJECT:CI timeout | merge only raises Windows runner ceiling / keeps drain ref
371aa579d6 | NEW-LANDMINE | `{...process.env, PATH}` on Windows leaves inherited `Path` beside `PATH`; resolver read the wrong list
40f4b3f650 | REF-APPEND:spawn-npm-enoent-einval | opencode launcher now `commandInvocation("opencode", args)` instead of bare spawn
48b985d079 | REJECT:app-specific path layout | Claude Desktop `LOCALAPPDATA\Claude-3p`; not shell
4dfc2d69bc | REJECT:Windows 8.3/realpath identity | `realpathSync.native` expands `RUNNER~1`; filesystem spelling, not PS
4feb9ace47 | REJECT:Windows TCP/port reclaim | `cmd.exe` used only to drop sockets; product plumbing
5252744857 | REJECT:Windows 8.3/realpath identity | merge of log-guard canonical-path + CI lookup timeout
52da777d96 | REJECT:Windows-but-not-PS | same catalog-off-loop as 159d2ab183
535e3c256b | REJECT:Windows-but-not-PS | fail-fast on unreadable process list; no shell trap
53ffc9eb9a | REJECT:Windows-but-not-PS | same short unknown-catalog retry as 125156c3e1
5c6be04ef6 | REJECT:Windows SQLite file lock | unfinalized Bun statements hold the DB open so unlink EBUSY; not shell
5d0c508966 | REJECT:Windows tray UI | removes `$menu.add_Opening({ Update-TrayState })`; tray UX
5e4a9d78ca | REJECT:Windows tray UI | same tray recovery patch as 5d0c508966
61a1edace6 | REJECT:Windows-but-not-PS | in-flight catalog observation → unknown; product
631a7fd404 | REJECT:Windows UAC/schtasks flow | Import-Module ScheduledTasks from System32 during elevation
6a09cb7ab3 | REJECT:Windows stop/restart | merge of update proxy recovery + already-classified drain ref
6c0bde453d | REJECT:unrelated | post-merge test/assertion fixes; GUI "Custom windows" string
772fc666f9 | REJECT:Windows TCP/port reclaim | harden reclaim vs foreign sockets / fake signals
77f5ae9bdd | REJECT:shim env scoping | stamps `OCX_BUN_RUNTIME_PATH` beside source; existing PS shim
79f923dc5d | NEW-LANDMINE | Windows `PATH=.;C:\...` lets cwd `npm.cmd` win over the real npm
7ee22fca55 | REJECT:unrelated fabric UI | duplicate FAB-07 increment
81ada7cd09 | REJECT:Unix rollback race | empty-launcher fingerprint; Windows does not take this path
856b37cfae | REJECT:Windows-but-not-PS | procfs/owner gaps are enumeration failures, not PS
86d7ef4943 | REJECT:Windows-but-not-PS | restart-identity recheck on CIM fallback
88c4f1561a | REJECT:CI timeout | Windows shard 15→25m; `accessSync(X_OK)` skip is POSIX-mode fixture, not a spawn trap
8f499a45f7 | REF-APPEND:node-path-host-delimiter | darwin/linux kiro paths used host `join`, so Windows hosts emitted backslashes
929d756314 | REJECT:Windows stop/restart | taskkill `/T /F` before service uninstall
9eaff97974 | NEW-LANDMINE | bare `spawn("claude")` skips PATHEXT (ENOENT); `spawn("claude.cmd")` is EINVAL; must PATH×PATHEXT then ComSpec `/d /s /c`
9edeeaf4c1 | REJECT:Windows junction/reparse | lab root boundary / scratch cleanup; not shell
a3f2fbcd16 | REJECT:runtime/timer hang | same unref'd kill-grace timer as 1ed2d7048e
a4686528e6 | REJECT:test-infra | scheduler fixtures pin `registrationInvalid`; no PS
aa9df919a5 | REJECT:Windows-but-not-PS | merge of fail-closed process query
b63f5c80fa | REF-APPEND:ps-file-extension-dispatch | writes both `codex.cmd` and `codex.ps1` shims because PATHEXT/PS dispatch both
ba77eb8e9b | REF-APPEND:spawn-npm-enoent-einval | resolve `kiro-cli.exe` (and skip directories that would EACCES) instead of bare `kiro-cli`
bb4c4a4f29 | REJECT:runtime/timer hang | unref'd grace timer + icacls timeout degrade
bc774699b1 | REF-APPEND:spawn-npm-enoent-einval | first `.cmd` EINVAL catalog probe via `shell:true`; also Git-Bash backslash note (see NEW)
bf8b0157ab | REJECT:runtime/timer hang | merge of drain/ACL fixes into update recovery
c035ee0934 | REJECT:Windows-but-not-PS | merge of catalog discovery off event loop
c7fe9e8081 | REJECT:app-specific path layout | `%LOCALAPPDATA%\Kiro-Cli\data.sqlite3`; HOME vs USERPROFILE is app store discovery
ce4e526368 | REJECT:Windows stop/restart | abort update unless stop exit 0; ~ expansion in npm launcher
d19a2c9504 | REJECT:Windows 8.3/realpath identity | link-aware follow-up so 8.3 widening does not accept junctions
d83a07c82a | REJECT:Windows UAC/schtasks flow | post-create scheduler settle before rollback
dc1df7d44d | REJECT:Windows-but-not-PS | fail closed when top-level process query fails
e22ef94209 | REF-APPEND:spawn-npm-enoent-einval | earlier kiro-cli PATH/`Path` + `.exe` fallback (ba77eb8e9b hardens isFile)
e43fce7fdd | REJECT:GUI feature | quota-window UI, not shells
ebf947ec57 | REF-APPEND:join-semicolon-splits-startprocess | elevation `Start-Process` fragments `.join("")` so `;` is only after `-Wait`; `exit $null`→0 comment
ef711801e9 | REJECT:docs-only | worktree allocation plans
fc82c92d00 | REJECT:Windows UAC/schtasks flow | same ScheduledTasks module import as 631a7fd404

NEW-LANDMINE summary

1. id: `pathext-exe-beats-cmd`  
category: env-paths  
On Windows, PATHEXT is `.COM;.EXE;.BAT;.CMD`, so a later-installed `foo.exe` in the same directory silently wins over `foo.cmd`. Any wrapper that only rewrites the `.cmd` shim is bypassed the moment an updater drops a sibling `.exe`.  
Key: [src/codex-shim.ts](/Users/jun/Developer/new/700_projects/opencodex/src/codex-shim.ts) @ 1b626e4f81 (installCodexShim originalPath `.exe` refresh) + [tests/win-exec.test.ts](/Users/jun/Developer/new/700_projects/opencodex/tests/win-exec.test.ts) `.exe beats .cmd via PATHEXT order`.

2. id: `spawn-npm-enoent-einval`  
category: aliases  
Shell-less Node/Bun `spawn("npm")` is ENOENT (no PATHEXT walk); `spawn("npm.cmd")` is EINVAL after CVE-2024-27980. `shell:true` is the wrong fix because Node does not escape cmd metacharacters. Resolve PATH×PATHEXT, spawn `.exe` directly, and route `.cmd`/`.bat` through `ComSpec /d /s /c` + `windowsVerbatimArguments`.  
Key: [src/lib/win-exec.ts](/Users/jun/Developer/new/700_projects/opencodex/src/lib/win-exec.ts) @ 9eaff97974 (new file, lines 1–105) + first hit [src/codex-catalog.ts](/Users/jun/Developer/new/700_projects/opencodex/src/codex-catalog.ts) @ bc774699b1 `codexExecInvocation`.

3. id: `env-path-vs-PATH-casing`  
category: env-paths  
Windows env names are case-insensitive, so `{...process.env, PATH: shims}` leaves inherited `Path` sitting beside the new `PATH`. Code that reads only `env.PATH ?? env.Path` (or `Object.keys` first-match) can walk the inherited list and miss the shims. Match the key however it is spelled, and never layer a second casing on a copied env.  
Key: [src/lib/win-exec.ts](/Users/jun/Developer/new/700_projects/opencodex/src/lib/win-exec.ts) @ 371aa579d6 lookup() + tests/win-exec.test.ts PATH/Path/path matrix.

4. id: `path-dot-hijacks-bare-npm`  
category: env-paths  
cmd.exe walks every PATH entry, including `.` and the working directory. `PATH=.;C:\Program Files\nodejs` makes a repo-local `npm.cmd` win, so opening a project can execute attacker npm at the user's privileges. Skip relative PATH entries and the exact cwd (not the whole home subtree — `%AppData%\npm` lives under home).  
Key: [go/internal/platform/winexec_common.go](/Users/jun/Developer/new/700_projects/opencodex/go/internal/platform/winexec_common.go) @ 79f923dc5d `ResolveWindowsCommandIn` + oracle [src/update/npm-invocation.mjs](/Users/jun/Developer/new/700_projects/opencodex/src/update/npm-invocation.mjs) lines 55–56.

Related but not a fifth id: bc774699b1 also notes Git-Bash `sh` will not parse backslash Windows paths inside a generated `#!/usr/bin/env sh` shim (`gitBashPath` converts to `C:/...`). That is WSL/Git-Bash interop, which the bar excludes; BOM on `.ps1` in the same commit is already `bom-less-ps1-cp949`.

Note vs existing/proposed issues: `spawn-npm-enoent-einval` matches planned issue #1 (distinct from `npm-ps1-not-comspec`, which is shim *selection*). `env-path-vs-PATH-casing` is a sibling of planned `node-path-host-delimiter` (host `path.delimiter`) but a different mechanism (duplicate Path/PATH keys). `path-dot-hijacks-bare-npm` is cwd/`.` PATH search, not WindowsApps EPERM.
