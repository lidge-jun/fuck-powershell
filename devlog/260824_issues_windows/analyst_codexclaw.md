14/14 commits classified. Two NEW-LANDMINEs (PATH `:` vs `;`, PATHEXT ENOENT on extensionless shims); the rest is product/test Windows plumbing or docs.

01ae4f37 | REJECT: NTFS-colon backups, CRLF checkout, EPERM teardown, separator assertions, pathToFileURL import — FS/test, not PS/shell-spawn | hook-trust.ts `.bak-${toISOString().replace(/:/g,"-")}`; `* text=auto eol=lf`; `pathToFileURL(...).href+"?ladder"`
098c6da0 | REJECT: Node ESM `file://`+path vs pathToFileURL (`file:///D:/...`); not PS/shell-spawn | `import.meta.url === pathToFileURL(process.argv[1]).href` in build.mjs / validate-evidence.mjs
13f68335 | REJECT: GitHub tag/branch rulesets; no shell semantics | 060_enforcement_layer.md protect-release-tags / protect-main; `install (windows-latest)` only named as a missing check
23e2fee2 | NEW-LANDMINE | `process.env.PATH = \`${binDir}${path.delimiter}${originalPath}\`` replaces hardcoded `:` in hook-trust.test.ts (SIGKILL/tilde/grep are product plumbing)
43a6febf | REJECT: macos matrix + skip POSIX tar on Windows; `shell: bash` only on ubuntu/macos, not a win-default-pwsh fix | packed-install.yml `if: runner.os != 'Windows'` archive steps; install job os=[ubuntu,macos]
81b65457 | REJECT: Windows CI spawn-timeout skip; not shell semantics | hook-bench.test.mjs `if (process.platform === "win32" && process.env.CI) return;`
8584d2ad | REJECT: product commandWindows path extractor; fixture-only `powershell -File …ps1`, no live PS fix | manifest-targets.ts PLUGIN_ROOT `[\\/]` matcher; WINDOWS_COMMAND fixture with `-ExecutionPolicy Bypass -File …node-dispatch.ps1`
95c07c0d | REJECT: test `path.relative()` separator assertion | review-deadlock.test.ts `st.planUnit?.split(/[\\/]/)`
9d01b637 | REJECT: product schtasks/.cmd service install + CRLF TOML; excluded service-plumbing | service.ts `buildWindowsScript` writes `serve.cmd`; `schtasks(["/create",…])`; activate.ts `lineEnding = preConfig.includes("\r\n")`
b4be8c17 | NEW-LANDMINE | hook-trust.test.ts skip: extensionless `join(binDir,"codex")` + `#!/bin/sh` → `spawnSync ENOENT` on NTFS/PATHEXT
c2cf505f | REJECT: docs-only research inventory (PATHEXT/BOM mentioned, no code fix) | 000_research.md shim.ts / PATHEXT / UTF-8 BOM for PS 5.1 bullets
dfd0f0cc | REJECT: release-gate CLI; no PS/shell-spawn | release-cli.ts / release-gate.ts; no win32/pwsh/spawn hits
e52bbd4c | REJECT: product hook-trust + explicit win32 unsupported throw; no PATHEXT/spawn fix | hook-trust.ts `if (process.platform === "win32") throw … commandWindows normalization is not implemented`
e78843b6 | REJECT: illegal `"` in Win filenames; execFileSync status/code was a misdiagnosed test-catch (retracted by 098c6da0) | source-identity.test.ts win32 drops `"quote"`; qa-validate-evidence.test.mjs `err.status ?? err.code`

NEW-LANDMINE summary

id: path-colon-not-delimiter
category: env-paths
trap: Joining PATH with `:` silently fails to prepend on Windows, where entries are `;`-separated, so the extra directory never participates in lookup. Tools look missing even though the file is on disk. Same bug in Node `process.env.PATH` and PowerShell `$env:Path = "$bin:$env:Path"`.
key file+line: [hook-trust.test.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts) ~PATH assignment using `path.delimiter` (23e2fee2)

id: pathext-bare-name-enoent
category: env-paths
trap: Node `spawnSync("codex")` / CreateProcess resolves via PATHEXT (`.EXE;.CMD;.BAT…`). An extensionless POSIX shebang shim on PATH is not a candidate, so spawn returns ENOENT even when the file exists and `chmod 755` was applied (no-op on NTFS). Distinct from npm-ps1-not-comspec (wrong shim wins) — here nothing PATHEXT-legal is found at all.
key file+line: [hook-trust.test.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts) skip comment + `join(binDir, "codex")` / `#!/bin/sh` shim (b4be8c17)
