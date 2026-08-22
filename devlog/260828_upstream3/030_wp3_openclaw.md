# 030 — wp3 openclaw/openclaw

Inventory: `inv/t1_openclaw.txt` (232 commits), `inv/issues_openclaw.txt` (105 open issues).

## Scale and method

232 commits out of an 81,534-commit history, all matching the narrow Tier-1
mechanism grep. This is the largest per-repo commit inventory of any round so far,
and it runs LAST so it meets the largest corpus.

**Deduplicate by patch-id before sampling anything.** The previous round learned
this the expensive way: 44 rows that looked like 44 judgments were 7 unique
patches re-landed across branches, and a sample of ten was mostly re-reading
duplicates. `git patch-id --stable` first, then read one representative per
unique patch.

## Surface

openclaw is a TypeScript agent runtime with heavy real-world Windows usage. Its
uncovered surfaces are the ones a long-running desktop agent has and a CLI does
not:

1. **Named pipes versus unix domain sockets.** Windows IPC is `\\\\.\\pipe\\name`,
   with different lifetime, permission, and path rules than a socket file. The
   corpus has nothing on this, and it is a strong POSIX-assumption break: there is
   no file on disk to `unlink`, and the "address" is a namespace entry.
2. **File watching.** No inotify. `ReadDirectoryChangesW` has different event
   coalescing, misses events under load, and reports directory-level rather than
   file-level changes in some modes. Uncovered, and a classic source of
   works-on-my-machine bugs.
3. **Console and VT mode.** Virtual terminal sequences must be explicitly enabled
   via `ENABLE_VIRTUAL_TERMINAL_PROCESSING`, and conhost behaves differently from
   Windows Terminal. `windowstyle-hidden-vs-windowshide` owns window creation
   flags; VT mode is a different sentence.
4. **Process trees.** Already partly owned by `unlink-while-open-ebusy` (no POSIX
   process groups, taskkill /T). A new case needs something beyond that.
5. **Installer and updater paths.** Replacing a running executable is impossible
   on Windows in the POSIX sense — the file is locked while it runs.
   `atomic-rename-loses-to-scanner` owns the transient-holder version; a
   self-replacement case would be about a permanent one.

## Expected shape

Two to five NEW. The named-pipe and file-watching families are the most likely,
because they are surfaces a desktop agent exercises constantly and none of the
five first-party repos did.

## Acceptance

- 232/232 commits and 105/105 issues dispositioned, with the patch-id collapse
  recorded so the reading effort is auditable.
- Gate chain green; prior coverage checks unchanged.
- Any process-tree or file-lock proposal explicitly distinguished from
  `unlink-while-open-ebusy` and `atomic-rename-loses-to-scanner`.

## Analyst return

Coverage 232/232 commits and 105/105 issues. The lane's commit tail is dominated
by `no-windows-mechanism`, which is a real finding rather than laziness: the
Tier-1 grep matched `utf-16` and caught 188 commits from a
`truncateUtf16Safe` sweep — string-length handling for surrogate pairs, which is
an API contract on every platform and not a Windows trap at all. The lane
confirmed those by patch-id clustering rather than reading each one.

The ISSUE half was the productive half, which is the point of admitting open
issues as evidence: openclaw's unresolved Windows reports carry mechanisms its
merged commits do not.

## Yield

| id | category | mechanism |
|---|---|---|
| cmd-lf-drops-first-byte | encoding | cmd.exe seeks through a batch file assuming CRLF, so an LF-only script loses the first byte of lines and reports commands nobody wrote |
| kill-hits-one-pid-or-the-whole-tree | exit-codes | Windows offers one-PID termination or a live parent-chain sweep and no opted-into group, so a kill orphans grandchildren and the fix kills the caller |

Both came from issue bodies with complete reproductions. `cmd-lf-drops-first-byte`
is the one worth flagging as newly URGENT rather than merely uncovered: its
modern trigger is AI agents writing `.cmd` files with default LF endings, which
did not exist as a failure source when batch files were written by Windows tools.

## Notable REFs

- `console-oem-bytes-as-utf8` (#113219, commits `512ef7f4` and `e6d2c9b0`) is
  `redirected-ps-output-mojibake` met from Node instead of Python or PowerShell.
  The lane argued for a split; the sentence is identical — a console child emits
  codepage bytes and the parent decodes them as UTF-8 — so it REFs.
- `win-backslash-is-literal` (four commits) is `backslash-quote-ends-span` from
  the parsing side rather than the quoting side.
- `drive-colon-not-field-separator` (three commits) REFs
  `path-colon-not-delimiter`: same character, same confusion, different consumer.
- `wsl-unc-cwd-rejected` REFs `wsl-unc-rejects-nt-acl`, which this round wrote
  from codex evidence — cmd refusing a UNC current directory is the same provider
  boundary.

## Held for a later round

`win32-stat-zero-inode` (libuv reporting `ino=0` under antivirus contention, so
identity-by-inode is undefined), `hidden-console-still-istty`,
`schtasks-ignore-new-drops-run`, and `node-symlink-defaults-file` are real and
uncovered. Each currently rests on a single issue or a mocked test, which is
under the evidence bar for a case whose whole value is being true.

## Commit dispositions (232)

| sha | disposition |
|---|---|
| d00cbd15 | REJECT no-windows-mechanism |
| a3b2700d | REJECT test-only (libuv zero-inode fallback; real but seen only in a mocked stat) |
| e72b1c76 | REJECT no-windows-mechanism |
| 94c360c6 | REJECT no-windows-mechanism |
| 01e7fca7 | REJECT no-windows-mechanism |
| 6c1ba314 | REJECT no-windows-mechanism |
| 29577fb0 | REJECT no-windows-mechanism |
| 570ef1ca | REJECT no-windows-mechanism |
| 8ae0a896 | REF lf-pure-transform-mixes-eol |
| 19030713 | REF utf8-bom-still-breaks-grep |
| 29497b4e | REJECT no-windows-mechanism |
| 859fd0b1 | REJECT no-windows-mechanism |
| ed17774f | REF utf8-bom-still-breaks-grep |
| 38d1a727 | REJECT no-windows-mechanism |
| 8347a52f | REJECT no-windows-mechanism |
| cc8e593c | REJECT no-windows-mechanism |
| 430859af | REJECT no-windows-mechanism |
| bb45edac | REJECT no-windows-mechanism |
| 9db4b991 | REJECT no-windows-mechanism |
| f267a4f9 | REJECT no-windows-mechanism |
| e228a3ca | REF bomless-bat-oem-codepage |
| e6ac6c85 | REJECT no-windows-mechanism |
| 676b397e | REJECT no-windows-mechanism |
| 1f05cb45 | REJECT no-windows-mechanism |
| 0c544e2c | REJECT no-windows-mechanism |
| 2fd3d860 | REJECT no-windows-mechanism |
| 42d42703 | REJECT no-windows-mechanism |
| 9a8ed459 | REJECT no-windows-mechanism |
| 9f471d01 | REJECT no-windows-mechanism |
| 979ddc29 | REJECT refactor |
| 0f9cc945 | REF session-path-stale |
| 45e681de | REJECT no-windows-mechanism |
| 2ebf0422 | REJECT no-windows-mechanism |
| 1338be03 | REJECT no-windows-mechanism |
| 789e7e2e | REJECT no-windows-mechanism |
| 3c7edce6 | REJECT no-windows-mechanism |
| dfeb1526 | REJECT no-windows-mechanism |
| aa8f7878 | REJECT no-windows-mechanism |
| 6c87afa7 | REJECT no-windows-mechanism |
| 26e1b18a | REJECT no-windows-mechanism |
| 3a4aa5fa | REJECT no-windows-mechanism |
| 4b27de4d | REJECT no-windows-mechanism |
| 4206535e | REJECT no-windows-mechanism |
| b2702156 | REJECT no-windows-mechanism |
| 1c576a27 | REJECT no-windows-mechanism |
| 9df2ad5d | REJECT no-windows-mechanism |
| c155e4db | REJECT no-windows-mechanism |
| 416d113a | REJECT no-windows-mechanism |
| 87261fd0 | REJECT no-windows-mechanism |
| 92870e52 | REJECT no-windows-mechanism |
| 58ef98ec | REJECT no-windows-mechanism |
| a498fc51 | REJECT no-windows-mechanism |
| ab9a1c9a | REJECT no-windows-mechanism |
| 13817a61 | REJECT no-windows-mechanism |
| af807360 | REJECT no-windows-mechanism |
| 67e1d439 | REJECT no-windows-mechanism |
| 7ac8e2e2 | REJECT no-windows-mechanism |
| 790cd2af | REJECT no-windows-mechanism |
| 57a3b1e9 | REJECT no-windows-mechanism |
| 9dee9ebf | REJECT no-windows-mechanism |
| 42578754 | REJECT no-windows-mechanism |
| 6f6c802e | REJECT no-windows-mechanism |
| 5bb5e4fb | REJECT no-windows-mechanism |
| c8ebfd8a | REJECT no-windows-mechanism |
| e484bdd9 | REJECT no-windows-mechanism |
| 4d004e20 | REJECT no-windows-mechanism |
| b7458623 | REJECT no-windows-mechanism |
| 0990bccb | REJECT no-windows-mechanism |
| 328eaa3a | REJECT no-windows-mechanism |
| 2894a42a | REJECT no-windows-mechanism |
| 8021f351 | REJECT docs-only |
| bb16ca50 | REJECT no-windows-mechanism |
| 1d4c1707 | REJECT no-windows-mechanism |
| b714fdb3 | REJECT no-windows-mechanism |
| b451d8b5 | REJECT no-windows-mechanism |
| 88acda11 | REJECT no-windows-mechanism |
| 8c78e1c0 | REJECT no-windows-mechanism |
| 921b6c1e | REJECT no-windows-mechanism |
| fe18ceda | REJECT no-windows-mechanism |
| 5ef269c2 | REJECT no-windows-mechanism |
| 20646156 | REJECT no-windows-mechanism |
| 4c55d462 | REJECT no-windows-mechanism |
| 2e9e46bb | REJECT no-windows-mechanism |
| 763ef215 | REJECT no-windows-mechanism |
| 0e626690 | REJECT no-windows-mechanism |
| f786efdd | REJECT no-windows-mechanism |
| 5b2c3169 | REJECT no-windows-mechanism |
| 813a5da8 | REJECT no-windows-mechanism |
| e99b5deb | REJECT no-windows-mechanism |
| 54976624 | REJECT no-windows-mechanism |
| 7222e3e1 | REJECT no-windows-mechanism |
| 57c468ca | REJECT no-windows-mechanism |
| d750477d | REJECT no-windows-mechanism |
| 0aae1ea8 | REJECT no-windows-mechanism |
| 0bdd646f | REJECT no-windows-mechanism |
| 6c3a46fb | REJECT no-windows-mechanism |
| ac710748 | REJECT no-windows-mechanism |
| 08663917 | REJECT no-windows-mechanism |
| 5ba981a4 | REJECT no-windows-mechanism |
| 0ac89337 | REJECT no-windows-mechanism |
| c067802c | REJECT no-windows-mechanism |
| c335ecdb | REJECT no-windows-mechanism |
| 0a8677ec | REJECT no-windows-mechanism |
| 29d2a1ed | REJECT no-windows-mechanism |
| c87b9a7c | REJECT no-windows-mechanism |
| 1beea4b8 | REJECT no-windows-mechanism |
| 6ad8a77b | REJECT no-windows-mechanism |
| e39e628a | REJECT no-windows-mechanism |
| fae5421f | REJECT no-windows-mechanism |
| 4be6fa74 | REJECT no-windows-mechanism |
| f650d641 | REJECT no-windows-mechanism |
| d0264de0 | REJECT no-windows-mechanism |
| b8cca6ac | REJECT no-windows-mechanism |
| 4792fa58 | REJECT no-windows-mechanism |
| 9bf21276 | REJECT no-windows-mechanism |
| bb1fa401 | REJECT no-windows-mechanism |
| 4ad94feb | REJECT no-windows-mechanism |
| 0de5d37f | REJECT no-windows-mechanism |
| f7cc6ebe | REJECT no-windows-mechanism |
| 3ac7729f | REJECT no-windows-mechanism |
| 6a3834d4 | REJECT no-windows-mechanism |
| 32de6661 | REJECT no-windows-mechanism |
| 145b71f5 | REJECT no-windows-mechanism |
| ed9ce1c5 | REJECT no-windows-mechanism |
| 49a5b6a2 | REJECT no-windows-mechanism |
| 8c608ae6 | REJECT no-windows-mechanism |
| 720aeb15 | REJECT no-windows-mechanism |
| d0c49a7a | REJECT no-windows-mechanism |
| 51bb5f68 | REJECT no-windows-mechanism |
| f0d4d4f2 | REJECT no-windows-mechanism |
| e5aefd56 | REJECT no-windows-mechanism |
| f0cc5e50 | REJECT no-windows-mechanism |
| 3e787f31 | REJECT no-windows-mechanism |
| 4fa31180 | REJECT no-windows-mechanism |
| 472e5167 | REJECT no-windows-mechanism |
| bc6a4bdd | REJECT no-windows-mechanism |
| 18e80760 | REJECT no-windows-mechanism |
| 4adfc30b | REJECT no-windows-mechanism |
| 7de325d0 | REJECT no-windows-mechanism |
| a3f00d32 | REJECT no-windows-mechanism |
| acac359d | REJECT no-windows-mechanism |
| 9b4cbe47 | REJECT no-windows-mechanism |
| 1d4d8474 | REJECT no-windows-mechanism |
| 6e4670f9 | REJECT no-windows-mechanism |
| 9614129c | REJECT no-windows-mechanism |
| 9e75ce9d | REJECT no-windows-mechanism |
| 7daa0909 | REJECT no-windows-mechanism |
| e90bf318 | REJECT no-windows-mechanism |
| e8bd3ae2 | REJECT no-windows-mechanism |
| 7e032426 | REJECT no-windows-mechanism |
| 5bdea31c | REJECT no-windows-mechanism |
| a9582a1b | REJECT no-windows-mechanism |
| d26a8427 | REJECT no-windows-mechanism |
| 42fc9e8a | REJECT no-windows-mechanism |
| 3db8174f | REJECT no-windows-mechanism |
| 2fe39692 | REJECT no-windows-mechanism |
| e7d617d4 | REJECT no-windows-mechanism |
| 78f9449d | REJECT no-windows-mechanism |
| 84d0a714 | REJECT no-windows-mechanism |
| 37d613a5 | REJECT no-windows-mechanism |
| c2cc50c9 | REJECT no-windows-mechanism |
| 5511b6fc | REJECT no-windows-mechanism |
| 9fb24032 | REJECT no-windows-mechanism |
| 079a704d | REJECT no-windows-mechanism |
| 24048717 | REJECT no-windows-mechanism |
| b84ae420 | REJECT no-windows-mechanism |
| d01015b2 | REJECT no-windows-mechanism |
| ccbd9eb2 | REJECT no-windows-mechanism |
| 048fe085 | REJECT no-windows-mechanism |
| 3929c520 | REJECT no-windows-mechanism |
| ac244612 | REJECT no-windows-mechanism |
| 84e53277 | REJECT no-windows-mechanism |
| 1d375c31 | REJECT test-only |
| 8380667b | REJECT no-windows-mechanism |
| 685c22df | REJECT no-windows-mechanism |
| abde81a6 | REJECT no-windows-mechanism |
| 66081c09 | REJECT no-windows-mechanism |
| fda00a0f | REJECT no-windows-mechanism |
| d9d61080 | REJECT no-windows-mechanism |
| 8028269d | REF env-path-vs-PATH-casing |
| c16bb872 | REJECT no-windows-mechanism |
| f92ec2d4 | REJECT test-only |
| 6299b679 | REJECT no-windows-mechanism |
| 41097555 | REJECT no-windows-mechanism |
| 352f47f8 | REJECT no-windows-mechanism |
| 1841c4ca | REJECT no-windows-mechanism |
| e8d7b1fe | REJECT no-windows-mechanism |
| 686a2876 | REJECT no-windows-mechanism |
| c9d2edfb | REJECT no-windows-mechanism |
| 4b36cf45 | REJECT no-windows-mechanism |
| e445d614 | REJECT no-windows-mechanism |
| 1b8b8500 | REJECT no-windows-mechanism |
| e5c3c59c | REJECT no-windows-mechanism |
| 2e881ab1 | REJECT no-windows-mechanism |
| 90c20d15 | REJECT no-windows-mechanism |
| cb8bc71f | REJECT no-windows-mechanism |
| 6c5a9fde | REJECT no-windows-mechanism |
| f5148aff | REF windowstyle-hidden-vs-windowshide |
| 9192ff84 | REF utf8-bom-still-breaks-grep |
| df87b40b | REJECT no-windows-mechanism |
| 6567f996 | REF utf8-bom-still-breaks-grep |
| a1170646 | REF bom-less-ps1-cp949 |
| 2990c00c | REF utf8-bom-still-breaks-grep |
| 684a9b2e | REF wsl-unc-rejects-nt-acl (UNC as cwd refused by cmd shims) |
| 4182fbaa | REF native-stderr-errorrecord |
| d06f0a0e | REF native-stderr-errorrecord |
| 8847d390 | REJECT repo-specific |
| 5adbbaa3 | REF spawn-npm-enoent-einval |
| f126f72d | REF pathext-bare-name-enoent |
| b73317c2 | REF path-colon-not-delimiter (drive colon taken as a field separator) |
| d02fbc61 | REF path-colon-not-delimiter |
| 3e4f0767 | REF spawn-npm-enoent-einval |
| 890a0530 | REF utf8-bom-still-breaks-grep |
| 55e6ab34 | REF utf8-bom-still-breaks-grep |
| 512ef7f4 | REF redirected-ps-output-mojibake (console OEM bytes decoded as UTF-8) |
| e6d2c9b0 | REF redirected-ps-output-mojibake |
| c1f423f8 | REF utf8-bom-still-breaks-grep |
| 4938b2cc | REF cmd-start-ampersand-splits |
| f7a10d67 | REJECT refactor |
| 187d3ed0 | REJECT repo-specific |
| f8547fca | REJECT no-windows-mechanism |
| 193ad2f4 | REF execution-policy-file-block |
| 6e008e93 | REF spawn-npm-enoent-einval |
| 196a7dbd | REJECT test-only |
| 6244ef9e | REF path-colon-not-delimiter |
| ab0d8ef8 | REF backslash-quote-ends-span (backslash literal except before a quote) |
| c50183fe | REF backslash-quote-ends-span |
| f641b945 | REF backslash-quote-ends-span |
| d91e995e | REJECT repo-specific |
| 4e23b7f6 | REJECT no-windows-mechanism |
| e389bd47 | REF backslash-quote-ends-span |
| 63f5fa47 | REJECT no-windows-mechanism |

## Open-issue dispositions (105)

| issue | disposition |
|---|---|
| #119882 | REF startup-artifact-is-not-a-process |
| #44291 | REJECT test-only |
| #121188 | REJECT repo-specific |
| #91144 | REF startup-artifact-is-not-a-process |
| #120134 | NEW kill-hits-one-pid-or-the-whole-tree (taskkill /T killing the caller) |
| #127352 | REJECT repo-specific |
| #112051 | REF session-path-stale |
| #97800 | REF windowstyle-hidden-vs-windowshide |
| #124125 | REJECT no-windows-mechanism |
| #119281 | REJECT no-windows-mechanism |
| #106203 | REJECT no-windows-mechanism |
| #18985 | REJECT no-windows-mechanism |
| #126874 | REJECT no-windows-mechanism |
| #88372 | REJECT no-windows-mechanism |
| #49931 | REJECT no-windows-mechanism |
| #111900 | NEW kill-hits-one-pid-or-the-whole-tree (kill leaves descendants running) |
| #115430 | REF windowsapps-alias-eperm (a protected install directory rather than a Store alias) |
| #118587 | REJECT no-windows-mechanism |
| #89527 | REJECT no-windows-mechanism |
| #119484 | NEW cmd-lf-drops-first-byte |
| #77804 | REJECT no-windows-mechanism |
| #74378 | REJECT no-windows-mechanism |
| #120771 | REJECT no-windows-mechanism |
| #48117 | REJECT no-windows-mechanism |
| #89223 | REJECT no-windows-mechanism |
| #127250 | REJECT docs-only |
| #106149 | REJECT no-windows-mechanism |
| #127411 | REJECT no-windows-mechanism |
| #78855 | REJECT security-unrelated |
| #108236 | REJECT no-windows-mechanism |
| #104389 | REJECT no-windows-mechanism |
| #108265 | REJECT no-windows-mechanism |
| #121821 | REJECT no-windows-mechanism |
| #88543 | REJECT no-windows-mechanism |
| #122834 | REF startup-artifact-is-not-a-process |
| #111620 | REF zip-entry-drive-letter-escapes (POSIX drive spellings resolving under the current drive) |
| #114207 | REJECT no-windows-mechanism |
| #114208 | REJECT no-windows-mechanism |
| #120112 | REJECT docs-only |
| #119361 | REJECT no-windows-mechanism |
| #105667 | REF zip-entry-drive-letter-escapes |
| #122593 | REJECT no-windows-mechanism |
| #127925 | REF unlink-while-open-ebusy (symlink type and privilege) |
| #111595 | REF path-case-sensitive-map |
| #127176 | REJECT no-windows-mechanism |
| #127930 | REJECT test-only |
| #90985 | REJECT no-windows-mechanism |
| #127929 | REF unlink-while-open-ebusy |
| #126011 | REF startup-artifact-is-not-a-process |
| #127931 | REF unlink-while-open-ebusy |
| #127924 | REF unlink-while-open-ebusy |
| #126905 | REJECT test-only |
| #122740 | REJECT no-windows-mechanism |
| #124407 | REJECT no-windows-mechanism |
| #102755 | REJECT no-windows-mechanism |
| #114200 | REJECT no-windows-mechanism |
| #105528 | REJECT repo-specific (issue-only, no reproducing commit in the frozen window) |
| #123176 | REJECT no-windows-mechanism |
| #116954 | REF path-case-sensitive-map |
| #114206 | REJECT no-windows-mechanism |
| #114382 | REJECT security-unrelated |
| #120377 | REF atomic-rename-loses-to-scanner |
| #121713 | REJECT no-windows-mechanism |
| #122659 | REJECT no-windows-mechanism |
| #113219 | REF redirected-ps-output-mojibake |
| #117080 | REJECT no-windows-mechanism |
| #112423 | REJECT no-windows-mechanism |
| #94716 | REJECT no-windows-mechanism |
| #91396 | REJECT no-windows-mechanism |
| #77142 | REJECT no-windows-mechanism |
| #53408 | REJECT no-windows-mechanism |
| #115908 | REJECT no-windows-mechanism |
| #115034 | REJECT no-windows-mechanism |
| #116240 | REJECT no-windows-mechanism |
| #120183 | REJECT no-windows-mechanism |
| #82735 | REJECT no-windows-mechanism |
| #127514 | REJECT no-windows-mechanism |
| #95072 | REJECT no-windows-mechanism |
| #127164 | REJECT repo-specific |
| #103067 | REJECT no-windows-mechanism |
| #127364 | REJECT repo-specific |
| #122712 | REJECT no-windows-mechanism |
| #120394 | REJECT no-windows-mechanism |
| #90158 | REF startup-artifact-is-not-a-process |
| #112173 | REF windowstyle-hidden-vs-windowshide (a hidden console is still a TTY) |
| #120507 | REJECT no-windows-mechanism |
| #121049 | REJECT no-windows-mechanism |
| #78805 | REJECT no-windows-mechanism |
| #119229 | REJECT no-windows-mechanism |
| #85408 | REJECT no-windows-mechanism |
| #45771 | REJECT no-windows-mechanism |
| #79625 | REJECT no-windows-mechanism |
| #105513 | REJECT no-windows-mechanism |
| #58289 | REJECT no-windows-mechanism |
| #92285 | REJECT no-windows-mechanism |
| #118018 | REJECT no-windows-mechanism |
| #53600 | REJECT no-windows-mechanism |
| #90944 | REJECT no-windows-mechanism |
| #98435 | REJECT no-windows-mechanism |
| #101190 | REJECT no-windows-mechanism |
| #37967 | REJECT no-windows-mechanism |
| #50291 | REJECT no-windows-mechanism |
| #114198 | REJECT no-windows-mechanism |
| #86050 | REJECT no-windows-mechanism |
| #83959 | REJECT no-windows-mechanism |
