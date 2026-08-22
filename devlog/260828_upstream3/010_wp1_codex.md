# 010 — wp1 openai/codex

Inventory: `inv/t1_codex.txt` (44 commits), `inv/issues_codex.txt` (176 open issues).

## Surface

codex is a Rust CLI with a sandbox, an exec layer, a PTY, and an apply-patch
implementation. Its Windows exposure differs from every repo mined so far in one
structural way: **Windows has no seccomp or landlock equivalent**, so the sandbox
is not a port of the POSIX design but a different design. That is the most
promising vein here, because the corpus has nothing about Windows process
isolation at all.

Four surfaces worth reading in full, all visible in the frozen inventory:

1. **WSL UNC paths.** Three commits skip ACL refresh for WSL UNC roots. A
   `\\\\wsl.localhost\\...` path is a UNC path that Win32 APIs accept and most
   path logic does not expect, and ACL operations against it behave differently
   from a local path. The corpus has no UNC case.
2. **cmd.exe session env capture.** Two commits about capturing and re-supplying
   the environment from a `cmd.exe` session. Environment inheritance across a
   shell hop is where `cmd-posix-env-prefix` and `envpath-pollutes-user` live, so
   the bar for a third case here is high.
3. **PathUri drive-letter canonicalization.** A documentation commit, which
   usually means REJECT docs-only — but the underlying rule (how a drive letter
   canonicalizes inside a URI) is adjacent to `file-url-encodes-backslash` and
   `dynamic-import-needs-file-url`, so read it before deciding.
4. **apply-patch and CRLF.** `split-n-leaves-cr` and `lf-pure-transform-mixes-eol`
   already own the read and write sides of CRLF residue. A third CRLF case needs a
   sentence neither owns — patch-application semantics might supply one, since a
   diff whose context lines have CRs will not apply against LF content.

## Expected shape

Most of the 44 commits will REJECT as test-only or CI. The 176 open issues are
the larger unknown, and the more interesting one: 176 unresolved Windows reports
against a widely used CLI is a lot of unfixed reality.

Realistic yield: one to three NEW. Zero is acceptable if everything is already
owned — the corpus is 76 cases deep and that is the point of the dedupe bar.

## Build steps

1. Re-read every anchor the explorer cites, first-hand, before writing anything.
2. Write accepted cases with full frontmatter, an ontology block, and the four
   required sections; add any missing mechanism concept.
3. Append refs to existing cases for REF rows.
4. Fill the disposition table for all 44 commits and all 176 issues.
5. Regenerate graph and skill, run the gate chain, dispatch the A-gate reviewer.

## Acceptance

- 44/44 commits and 176/176 issues dispositioned.
- Gate chain green; the five prior mining coverage checks unchanged.
- Every NEW case cites a reachable github.com/openai/codex commit or issue URL.

## Analyst return

Coverage 44/44 commits and 176/176 issues. The lane proposed 14 candidates; the
main agent re-read every anchor and accepted five, downgraded seven to REF, and
rejected two on evidence quality.

## Yield

| id | category | mechanism |
|---|---|---|
| wsl-unc-rejects-nt-acl | env-paths | a WSL UNC root is served by the 9P provider and has no NTFS security descriptor, so ACL hardening fails with access-denied on a path that lists fine |
| path-unmatched-quote-swallows | env-paths | PATH entries may be quoted, so one stray quote makes a correct quote-aware parser swallow every later entry while the shell keeps working |
| createprocess-cmdline-32767 | args-quoting | the command line is capped at 32,767 characters and the overflow reports as the same error code MAX_PATH uses |
| path-case-sensitive-map | env-paths | NTFS matches paths case-insensitively while every string container treats two spellings as two keys |
| altgr-reports-as-ctrl-alt | parsing | Windows reports AltGr as Ctrl+Alt, so a Ctrl-means-shortcut handler eats real characters on layouts that need it |
| cmd-c-newline-not-separator | args-quoting | cmd /c takes one command line, so an embedded newline does not start a second command the way it does in a batch file or under sh -c |

## Downgrades and rejections worth recording

- The lane proposed `extended-prefix-not-dos-path` for issues #39689, #39378,
  #39150, #39209, #39705 — an extended-length path leaking into a later call that
  cannot resolve it. That is a real trap, and it is the SAME sentence
  `max-path-260` already carries in its workaround section: the prefix is not a
  DOS path and not every consumer accepts it. REFed, and the existing case's
  workaround already warns about it explicitly.
- `posix-slash-is-drive-root` (#40100, #32474) and `leading-slash-is-drive-root`
  describe a POSIX absolute path resolving against the current drive.
  `zip-entry-drive-letter-escapes` owns the "Windows has several absolute forms
  and a POSIX check sees none of them" sentence; this is its mirror and REFs to it.
- `cmd-set-emits-drive-cwd` was rejected as `test-only`. The lane flagged its own
  weakness: the `=C:` pseudo-variables appear in a parser fixture, not in a user
  report. Real behavior, no evidence of anyone being hurt by it.
- `cet-unsupported-fail-fast` (#39843, #39711) was rejected as `repo-specific`.
  A .NET binary fail-fasting on a machine with incomplete CET support is a
  servicing problem, not a POSIX-assumption break — the generalizability bar asks
  what a stranger would learn, and the answer here is "install Windows updates".
- `powershell-loads-profile`, `pwsh-modulepath-pollutes-51` and
  `constrained-language-forbids-setter` are genuinely uncovered and were held for
  the hermes cycle, where the same three mechanisms appear with stronger evidence
  (`constrained-language-blocks-dotnet` at #89857 carries a real error class).

## Commit dispositions (44)

| sha | disposition |
|---|---|
| 3685a61d | REJECT no-windows-mechanism (naive CR-to-LF substitution is a string bug on any platform) |
| 661339bb | REJECT docs-only |
| 707bd3cc | REJECT test-only |
| f142f1f7 | REJECT no-windows-mechanism |
| ee3f14b2 | REJECT refactor |
| 5e58b6d7 | REJECT refactor |
| 2e48f92f | REJECT refactor |
| 2662873a | REF lf-pure-transform-mixes-eol |
| 0b08bbb9 | REJECT repo-specific |
| 37c8aefa | REJECT no-windows-mechanism |
| 1b3b6da2 | REJECT no-windows-mechanism |
| 8a2bc6d9 | NEW wsl-unc-rejects-nt-acl |
| 1f0fe5b8 | NEW cmd-c-newline-not-separator |
| f3596f71 | REJECT test-only (drive-cwd pseudo-variables seen only in a parser fixture) |
| a1441890 | REF wsl-unc-rejects-nt-acl |
| 7dbf1d7c | REF wsl-unc-rejects-nt-acl |
| a6cfdbf7 | REF wsl-unc-rejects-nt-acl |
| b15c9188 | REF pathext-bare-name-enoent |
| c1a29a13 | REF pathext-bare-name-enoent |
| 14f95db5 | REF pathext-bare-name-enoent |
| 96a85537 | REF pathext-bare-name-enoent |
| beb3978a | REJECT test-only |
| fa49cae7 | REJECT test-only |
| deba695a | REJECT test-only |
| 68baac7c | REJECT no-windows-mechanism |
| 8ede1801 | REJECT no-windows-mechanism |
| 1b70881a | REJECT no-windows-mechanism |
| 3cd13014 | REF split-n-leaves-cr |
| 5810c1b1 | REF split-n-leaves-cr |
| 3545251f | REF max-path-260 |
| d9232403 | REJECT repo-specific |
| c961ee9c | REJECT repo-specific |
| 3685117e | REJECT no-windows-mechanism |
| 9e91e49e | REF lf-pure-transform-mixes-eol |
| 6c9c563f | REF lf-pure-transform-mixes-eol |
| ac821fd9 | REJECT test-only |
| 702238f0 | NEW altgr-reports-as-ctrl-alt |
| b560c5ce | REJECT no-windows-mechanism |
| 37fba28a | REJECT no-windows-mechanism |
| 625f2208 | REF spawn-npm-enoent-einval |
| 699c1216 | REJECT no-windows-mechanism |
| 9590c08d | REF lf-pure-transform-mixes-eol |
| 3a953c8b | REF lf-pure-transform-mixes-eol |
| 568d6f81 | REJECT no-windows-mechanism |

## Open-issue dispositions (176)

| issue | disposition |
|---|---|
| #36560 | REF windowstyle-hidden-vs-windowshide |
| #37599 | REF windowstyle-hidden-vs-windowshide |
| #38683 | REJECT docs-only |
| #39843 | REJECT repo-specific (CET fail-fast is a .NET/OS servicing issue, not a POSIX-assumption break) |
| #39484 | REJECT repo-specific |
| #36247 | HELD powershell-loads-profile (uncovered; profile injection into -Command, needs a second source) |
| #37306 | REJECT repo-specific |
| #26803 | REJECT repo-specific |
| #26613 | REF windowstyle-hidden-vs-windowshide |
| #38069 | REJECT repo-specific |
| #40060 | REJECT repo-specific |
| #37578 | REJECT repo-specific |
| #38137 | REJECT repo-specific |
| #34266 | REF windowstyle-hidden-vs-windowshide |
| #37962 | REJECT repo-specific |
| #38898 | REJECT repo-specific |
| #37592 | REJECT repo-specific |
| #38290 | REJECT repo-specific |
| #38345 | REJECT repo-specific |
| #39711 | REJECT repo-specific |
| #39841 | REJECT repo-specific |
| #37506 | REJECT repo-specific |
| #38421 | NEW path-unmatched-quote-swallows |
| #33891 | REF windowstyle-hidden-vs-windowshide |
| #39574 | REJECT repo-specific |
| #38301 | REF windowstyle-hidden-vs-windowshide |
| #30024 | REJECT repo-specific |
| #21606 | REJECT repo-specific |
| #26896 | REJECT repo-specific |
| #34577 | REJECT repo-specific |
| #40102 | REJECT repo-specific |
| #40101 | REJECT repo-specific |
| #35827 | REF windowstyle-hidden-vs-windowshide |
| #36118 | REF execution-policy-file-block |
| #39418 | REJECT no-windows-mechanism |
| #37769 | REJECT repo-specific |
| #40075 | REJECT repo-specific |
| #38886 | REJECT repo-specific |
| #37576 | REF env-path-vs-PATH-casing |
| #33311 | REJECT repo-specific |
| #38216 | REJECT repo-specific |
| #30481 | REJECT no-windows-mechanism |
| #39248 | REF max-path-260 |
| #39689 | REF max-path-260 (extended-length prefix leaking into a later DOS-path call) |
| #39399 | REF esm-is-main-file-url |
| #39378 | REF max-path-260 |
| #39150 | REF max-path-260 |
| #40100 | REF zip-entry-drive-letter-escapes (POSIX leading slash resolving to the current drive root) |
| #39209 | REF max-path-260 |
| #38694 | REJECT repo-specific |
| #39855 | REJECT repo-specific |
| #39502 | REJECT repo-specific |
| #39387 | REJECT repo-specific |
| #31413 | REF env-path-vs-PATH-casing |
| #32474 | REF zip-entry-drive-letter-escapes |
| #36608 | REJECT repo-specific |
| #37501 | REJECT no-windows-mechanism |
| #37255 | REJECT repo-specific |
| #40002 | NEW path-case-sensitive-map |
| #37739 | REJECT repo-specific |
| #39705 | REF max-path-260 |
| #37559 | REF max-path-260 |
| #39215 | REJECT repo-specific |
| #39318 | REJECT repo-specific |
| #36768 | REF max-path-260 |
| #37153 | REF windowstyle-hidden-vs-windowshide |
| #28075 | REJECT repo-specific |
| #37589 | REJECT repo-specific |
| #37595 | REJECT repo-specific |
| #37293 | REF windowsapps-alias-eperm |
| #27334 | REF env-path-vs-PATH-casing |
| #38293 | REF windowsapps-alias-eperm |
| #39486 | REJECT repo-specific |
| #27822 | REF bom-less-ps1-cp949 |
| #35910 | REF max-path-260 |
| #29072 | REF windowsapps-alias-eperm |
| #37911 | REJECT no-windows-mechanism |
| #32958 | REF bom-less-ps1-cp949 |
| #35349 | REJECT repo-specific |
| #13755 | REF redirected-ps-output-mojibake |
| #35527 | REF bom-less-ps1-cp949 |
| #34674 | REJECT repo-specific |
| #36023 | REF bom-less-ps1-cp949 |
| #37740 | REF bomless-bat-oem-codepage |
| #36844 | REF bom-less-ps1-cp949 |
| #36375 | REJECT repo-specific |
| #9767 | HELD constrained-language (uncovered; see 050 held list) |
| #28079 | REF bom-less-ps1-cp949 |
| #23903 | REF atomic-rename-loses-to-scanner |
| #39276 | REJECT repo-specific |
| #27390 | REJECT no-windows-mechanism |
| #9580 | REJECT no-windows-mechanism |
| #27784 | REF utf8-bom-still-breaks-grep |
| #8340 | REF utf8-bom-still-breaks-grep |
| #38923 | REJECT repo-specific |
| #35446 | REJECT repo-specific |
| #23044 | REF bom-less-ps1-cp949 |
| #10090 | REJECT repo-specific |
| #31219 | REJECT no-windows-mechanism |
| #25497 | REJECT repo-specific |
| #30722 | REJECT repo-specific |
| #39135 | REJECT repo-specific |
| #33220 | REJECT repo-specific |
| #39968 | REJECT repo-specific |
| #25178 | REJECT repo-specific |
| #28226 | REJECT repo-specific |
| #18466 | REJECT repo-specific |
| #24576 | REJECT repo-specific |
| #17208 | REF windowstyle-hidden-vs-windowshide |
| #27117 | HELD pwsh-modulepath (uncovered; see 050 held list) |
| #36123 | REJECT no-windows-mechanism |
| #34201 | REF bomless-bat-oem-codepage |
| #27506 | REF bom-less-ps1-cp949 |
| #28017 | REF bom-less-ps1-cp949 |
| #23712 | REJECT repo-specific |
| #14687 | REJECT repo-specific |
| #37427 | REF windowsapps-alias-eperm |
| #37272 | REF windowsapps-alias-eperm |
| #40069 | REJECT no-windows-mechanism |
| #37678 | REF windowsapps-alias-eperm |
| #35790 | REF reserved-dos-device-names |
| #37553 | REJECT repo-specific |
| #37415 | REF windowsapps-alias-eperm |
| #38029 | REJECT no-windows-mechanism |
| #37629 | REJECT repo-specific |
| #34672 | REJECT repo-specific |
| #38908 | REJECT no-windows-mechanism |
| #24740 | REJECT repo-specific |
| #27170 | REJECT repo-specific |
| #37793 | REJECT repo-specific |
| #34842 | REF icacls-inheritance-r-empty-dacl |
| #37453 | REJECT repo-specific |
| #38754 | REJECT repo-specific |
| #26304 | REJECT repo-specific |
| #34889 | REF icacls-inheritance-r-empty-dacl |
| #31768 | REJECT repo-specific |
| #37484 | REJECT repo-specific |
| #38968 | REJECT repo-specific |
| #34964 | REJECT no-windows-mechanism |
| #38168 | REF cmd-shim-reparses-argv |
| #38985 | NEW createprocess-cmdline-32767 |
| #37264 | REF icacls-inheritance-r-empty-dacl |
| #37509 | REJECT repo-specific |
| #38960 | REJECT repo-specific |
| #38528 | REF lf-pure-transform-mixes-eol |
| #32643 | REF lf-pure-transform-mixes-eol |
| #35232 | REF split-n-leaves-cr |
| #35789 | REF lf-pure-transform-mixes-eol |
| #25048 | REF lf-pure-transform-mixes-eol |
| #37302 | REF split-n-leaves-cr |
| #26945 | REJECT repo-specific |
| #23841 | REF lf-pure-transform-mixes-eol |
| #9914 | REF lf-pure-transform-mixes-eol |
| #24718 | REJECT repo-specific |
| #34167 | REJECT no-windows-mechanism |
| #23927 | REJECT repo-specific |
| #23787 | REF lf-pure-transform-mixes-eol |
| #28231 | REJECT no-windows-mechanism |
| #29066 | REF redirected-ps-output-mojibake |
| #34917 | REJECT repo-specific |
| #23848 | REJECT repo-specific |
| #9455 | REF lf-pure-transform-mixes-eol |
| #23893 | REF lf-pure-transform-mixes-eol |
| #23251 | REF lf-pure-transform-mixes-eol |
| #23923 | REF lf-pure-transform-mixes-eol |
| #32325 | REF split-n-leaves-cr |
| #35906 | REJECT no-windows-mechanism |
| #13721 | REJECT repo-specific |
| #28074 | REJECT repo-specific |
| #21750 | REJECT repo-specific |
| #17067 | REJECT no-windows-mechanism |
| #23863 | REF lf-pure-transform-mixes-eol |
| #25216 | REJECT no-windows-mechanism |
| #23851 | REJECT repo-specific |
| #27395 | REJECT repo-specific |
| #27644 | REJECT no-windows-mechanism |
