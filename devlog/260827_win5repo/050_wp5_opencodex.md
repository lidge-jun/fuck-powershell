# 050 — wp5 opencodex

Inventory: inv/win_opencodex.txt, 341 SHAs, Tier A grep, prior-round SHAs
excluded.

## Scale changes the method

341 rows is an order of magnitude past every other work-phase, and 7458 commits
of history means the Tier A grep still catches a lot of routine cross-platform
test maintenance. One analyst reading 341 full diffs is not a realistic packet,
so this work-phase splits the inventory into review bands and reads diffs only
where the band justifies it.

| band | filter | treatment |
|---|---|---|
| 1 | subject names a Windows mechanism (.ps1, comspec, pathext, crlf, cp949, lastexitcode, execution-policy, appexec, utf-16) | full git show, always |
| 2 | subject says Windows, pwsh, or powershell but names no mechanism | git show --stat first; full diff only if the stat touches non-test source |
| 3 | subject is test or CI maintenance mentioning windows | --stat only; REJECT test-only unless the stat contradicts it |

Every row still gets a disposition. The bands govern how much reading each row
earns, not whether it is examined, and the band is recorded in the table so the
gate can be re-audited.

## Dedupe load

opencodex already contributed windowstyle-hidden-vs-windowshide,
bun-ps-windowstyle-argv, english-and-not-separator,
join-semicolon-splits-startprocess, ps51-no-and-and, pwsh-leaks-lastexitcode,
plus ref appends to curl-alias and bom-less-ps1-cp949. By the time this
work-phase runs the corpus also holds everything wp1 through wp4 added, and every
proposal is checked against that full set.

## Surfaces

opencodex is a Rust and TypeScript coding agent with a shell-execution core, so
its Windows mechanisms cluster in the command runner (sh -lc versus cmd /c versus
pwsh -c dispatch), sandbox and permission handling, terminal and PTY behavior,
file watching, and the release and install lane. The PTY and file-watching
surfaces are uncovered by the corpus and are the most promising.

## Expected shape

Three to eight NEW from 341 rows, with a long REJECT tail. A low NEW count
against a fully covered ledger is a good outcome; a high NEW count is a signal to
re-check the dedupe bar before accepting them.

## Acceptance

- 341 of 341 SHAs dispositioned with band recorded.
- Gate chain green.
- Band-3 REJECTs spot-checked: at least ten randomly chosen band-3 rows get a
  full git show to confirm the band assignment was not hiding a real mechanism.

## Analyst lane retired

Same as wp2 and wp3: the dispatched lane returned nothing, so it was retired
under DISPATCH-RETIRE-01 and the main agent worked the inventory directly using
the three bands defined above.

## Band distribution (actual)

| band | rows | rule |
|---|---|---|
| b1 | 12 | subject names a concrete Windows mechanism; full git show on every one |
| b2 | 210 | Windows-labelled with no named mechanism; --stat first, full diff when it touched non-test source |
| b3 | 119 | test, CI, docs, devlog, or merge commits; --stat only |

The band-2 share is larger than 050 anticipated because opencodex ran a
months-long Windows stability program: service backends, ACL hardening, tray
hosts, and scheduler probes all carry Windows in the subject without naming a
mechanism. A large block of them is also a Go port that re-implements surfaces
the TypeScript side already had, which produces near-identical subjects
repeatedly — those are rejected as repo-specific rather than counted as new
evidence.

## Yield

Five NEW, at the top of the three-to-eight expectation, and 61 REF. The REF count
is the more interesting number: this repo supplied cross-repo evidence for
mechanisms discovered in the four earlier work-phases — the supervisor-absence
case picked up nine, the file-locking case eleven, and the identity case seven.
That is what a dependency-ordered work-phase map is supposed to produce.

| id | category | mechanism |
|---|---|---|
| lf-pure-transform-mixes-eol | encoding | an LF-pure transform on a CRLF file leaves mixed endings, so hashes, diffs, and the tool's own remove-pattern all disagree with the file |
| basename-split-slash-only | parsing | split("/") on a client-supplied Windows path returns the whole path, so allowlists and blocklists silently never match |
| redirected-ps-output-mojibake | encoding | PowerShell 5.1 encodes redirected output in the console codepage, so captured non-ASCII values are destroyed before the caller sees a byte |
| atomic-rename-loses-to-scanner | env-paths | a scanner's transient handle makes an atomic rename fail with EPERM/EBUSY/EACCES, so every durable publish needs a bounded retry |
| localized-cli-output-parsing | parsing | Windows built-in tools translate headings and status words, so substring checks test the machine's language rather than its state |

## Spot-check of band-3 rejects

Ten band-3 rows were read in full to confirm the band did not hide a mechanism:
712c493d8, 8034cd7c0, 4c46e00b5, 68af8f97c, e2f96707e, a6de95a67, f3a612054,
51857c9f0, dad534889, 5a4d968e6. All ten are genuinely test or CI work — timeout
budgets, shard pinning, teardown races, and cases that asserted machine state
instead of code behavior. The last group is interesting as a category (tests that
describe the machine) but is a testing lesson, not a Windows mechanism.

## Disposition table

| sha | band | disposition |
|---|---|---|
| 84ee2e284 | b3 | REJECT refactor (merge commit) |
| a3bbcdb03 | b2 | REF startup-artifact-is-not-a-process (opt-in desktop restart for a stale picker) |
| 174f03b60 | b3 | REJECT test-only |
| c0cbe494e | b3 | REJECT refactor (merge commit) |
| 4430742f6 | b2 | REF startup-artifact-is-not-a-process (full-restart helper) |
| 96f288d59 | b3 | REJECT refactor (merge commit) |
| 3204d4371 | b3 | REJECT refactor (merge commit) |
| 8f04c9a52 | b2 | REJECT repo-specific (CI lane) |
| 2e1c211e9 | b2 | REJECT repo-specific (CI lane) |
| b394b035b | b1 | REF split-n-leaves-cr (an LF-only hook pattern misses a CRLF rc file, so removal reports success and removes nothing) |
| 31ee7a683 | b3 | REJECT refactor (merge commit) |
| 9a9c09072 | b3 | REJECT test-only |
| caf20353f | b3 | REJECT refactor (merge commit) |
| 94ecc29b8 | b3 | REJECT test-only |
| 70e8bab42 | b3 | REJECT refactor (merge commit) |
| 030818f6c | b3 | REJECT test-only |
| 3fa405356 | b3 | REJECT test-only |
| fe8fc6fe8 | b3 | REJECT test-only |
| cd8f9b8ab | b3 | REJECT refactor (merge commit) |
| 75251bb03 | b3 | REJECT test-only |
| 360b66b3c | b2 | REF env-domain-principal (fail closed on the Windows ACL when a definition holds a credential) |
| a71d81adb | b3 | REJECT test-only |
| b2563de15 | b3 | REJECT test-only |
| ca32042a2 | b3 | REJECT refactor (merge commit) |
| c5c6644d7 | b2 | NEW atomic-rename-loses-to-scanner |
| fcc9e5022 | b2 | REF atomic-rename-loses-to-scanner (counting the retries so the envelope is evidence-backed) |
| a3169db77 | b2 | REF startup-artifact-is-not-a-process (one scheduler-wrapper killer scoped to one installation) |
| 497b64338 | b3 | REJECT test-only |
| 038fbad63 | b3 | REJECT test-only |
| 39fcb1a28 | b3 | REJECT test-only |
| 9fa762c56 | b3 | REJECT test-only |
| d8bf2bcb7 | b3 | REJECT refactor (merge commit) |
| 6a23ea98e | b3 | REJECT refactor (merge commit) |
| bb984ad47 | b3 | REJECT refactor (merge commit) |
| f3a612054 | b2 | REJECT repo-specific |
| 0f4b95bee | b3 | REJECT test-only |
| a6de95a67 | b2 | REJECT repo-specific |
| 51857c9f0 | b2 | REJECT repo-specific |
| 71f69edd7 | b3 | REJECT test-only |
| e2f96707e | b2 | REJECT test-only |
| 079f417c6 | b3 | REJECT test-only |
| c3882214f | b2 | REJECT repo-specific |
| dad534889 | b2 | REJECT repo-specific |
| 5a4d968e6 | b2 | REJECT repo-specific |
| 9122d5ebe | b2 | NEW known-folder-empty-not-error (split from the mojibake ref during the follow-up round) |
| 1828cb150 | b2 | REJECT repo-specific |
| 01b212579 | b3 | REJECT refactor (merge commit) |
| d09c75299 | b2 | REF startup-artifact-is-not-a-process (stop the service loop on a missing install) |
| 16bffe235 | b3 | REJECT refactor (merge commit) |
| 1da366eae | b2 | REF unlink-while-open-ebusy (a real termination path for app-servers) |
| 1e816ee81 | b2 | REF env-domain-principal (classify ACL hardening failures as 503) |
| f642a7b1f | b2 | NEW redirected-ps-output-mojibake |
| 42650711c | b2 | REJECT repo-specific |
| 3a749a201 | b3 | REJECT test-only |
| b96cc1d8e | b3 | REJECT test-only |
| ee043e75c | b3 | REJECT test-only |
| 1085b20d4 | b2 | REF startup-artifact-is-not-a-process (removing a native service in a fresh scheduler install) |
| 7bdc8f86c | b3 | REJECT refactor (merge commit) |
| d1c37dc5c | b2 | REF env-domain-principal (fail closed on principal resolver errors) |
| 872c5268a | b3 | REJECT test-only |
| b310d1826 | b2 | REJECT repo-specific |
| fcb337a18 | b2 | REF env-domain-principal (ARM64 ACL identity lookup) |
| 6312aef83 | b2 | REF startup-artifact-is-not-a-process (prove rollback task ownership or report residual state) |
| 1fa020a90 | b2 | REF startup-artifact-is-not-a-process (preflight registration before teardown) |
| fc149b1f5 | b3 | REJECT test-only |
| 6b83aa3a7 | b3 | REJECT test-only |
| c42075519 | b3 | REJECT test-only |
| 6d4924411 | b3 | REJECT test-only |
| 073573966 | b3 | REJECT test-only |
| dd020296c | b2 | REF windowstyle-hidden-vs-windowshide (hiding an npm launcher proxy child) |
| 3c40df209 | b3 | REJECT test-only |
| 66ef8993f | b3 | REJECT refactor (merge commit) |
| fca2cd712 | b2 | REF env-domain-principal (making the ACL identity boundary testable) |
| 972ed0ed3 | b2 | REF env-domain-principal (resolve the token SID instead of trusting USERDOMAIN and USERNAME) |
| 4e34ad2ad | b2 | REF unlink-while-open-ebusy (scoping restart cleanup) |
| 20cff4c3d | b2 | REF env-domain-principal (fail closed on ACL hardening) |
| 41bce86fe | b3 | REJECT test-only |
| bff31d1e0 | b3 | REJECT test-only |
| df6989c17 | b2 | REF env-domain-principal (same fix, second branch) |
| aa2849336 | b3 | REJECT test-only |
| 1fc24f039 | b3 | REJECT refactor (merge commit) |
| 3fc24da7c | b2 | REJECT repo-specific |
| 00f13cec2 | b2 | REJECT repo-specific |
| aa0e22121 | b2 | REJECT repo-specific |
| 06ee2745e | b3 | REJECT test-only |
| ca9618af6 | b2 | REJECT repo-specific |
| c4fb80ba7 | b2 | REJECT repo-specific |
| ca015f747 | b2 | REF localized-cli-output-parsing (only a definitive not-found counts as absent) |
| 153f8aab6 | b2 | REF localized-cli-output-parsing (walking the service definition chain instead of parsing prose) |
| 3a3323b3d | b1 | REF lf-pure-transform-mixes-eol (BOM preserved across a rewrite) |
| b5452a0a5 | b1 | REF lf-pure-transform-mixes-eol (same fix, second branch) |
| 77002f142 | b3 | REJECT test-only |
| b63e86a8b | b1 | REF lf-pure-transform-mixes-eol (regression: CRLF config survives inject byte-for-byte) |
| 68af8f97c | b2 | REJECT repo-specific (CI lane) |
| eba52e37b | b3 | REJECT test-only |
| 7f18569ea | b2 | REJECT repo-specific (CI lane) |
| 416ad2ff7 | b2 | REJECT repo-specific (CI lane) |
| 4c46e00b5 | b2 | REJECT test-only |
| 53f8da7a0 | b2 | REJECT repo-specific (CI lane) |
| 25e241572 | b2 | REJECT repo-specific (CI lane) |
| 8034cd7c0 | b2 | REJECT repo-specific (CI lane) |
| 712c493d8 | b2 | REJECT repo-specific (CI lane) |
| ea5c5a8e3 | b3 | REJECT test-only |
| cc48263c5 | b1 | REF split-n-leaves-cr (CRLF heading match in CI) |
| 6b0379690 | b3 | REJECT test-only |
| 80c49cfbf | b3 | REJECT test-only |
| f5586bcf0 | b2 | REF basename-split-slash-only (salvage backup directory named wrong on Windows) |
| fd5ca50fa | b3 | REJECT test-only |
| 850affb64 | b3 | REJECT test-only |
| f7f5b1bda | b2 | REJECT repo-specific |
| d5b88632a | b2 | REJECT repo-specific |
| 1c55ca83f | b3 | REJECT test-only |
| a26b379e9 | b2 | REJECT repo-specific |
| c8ee26074 | b2 | REJECT repo-specific |
| 2c2c11357 | b1 | REF redirected-ps-output-mojibake (UTF-16 key framing recorded as the design) |
| 0b30283b6 | b2 | REJECT repo-specific |
| 09b29b9ac | b2 | REJECT repo-specific |
| 9d271d091 | b2 | REJECT repo-specific |
| 9e7cc304f | b3 | REJECT test-only |
| 4d7ee28b2 | b2 | REJECT repo-specific |
| 8ddf196fe | b3 | REJECT test-only |
| d0b44e7a6 | b2 | REJECT repo-specific (CI lane) |
| aae9426ea | b3 | REJECT test-only |
| 7279a6f84 | b3 | REJECT test-only |
| f1fa46435 | b2 | REJECT test-only |
| 649fdf91a | b3 | REJECT test-only |
| 1ace71adc | b3 | REJECT test-only |
| aeb74231d | b3 | REJECT test-only |
| f27ed583b | b2 | REJECT test-only |
| ed929181f | b2 | REF atomic-rename-loses-to-scanner (dir-fsync recorded after a best-effort attempt) |
| b6c39ac84 | b2 | REJECT repo-specific (CI lane) |
| 60be0c50b | b2 | REF process-exit-fastfail-0xc0000409 (keeping short mutation wait timers ref'd) |
| 675eb6ac7 | b3 | REJECT test-only |
| 584d3810d | b3 | REJECT test-only |
| 54a13e150 | b3 | REJECT test-only |
| 30bd1f2d6 | b3 | REJECT test-only |
| 85030c7de | b3 | REJECT test-only |
| 1ce6a2cfc | b3 | REJECT test-only |
| 1029e37cd | b3 | REJECT test-only |
| fa5780d59 | b3 | REJECT test-only |
| 2b80061da | b2 | REF unlink-while-open-ebusy (spawning a GUI worker without inheriting the listen socket) |
| de87f4957 | b2 | REF unlink-while-open-ebusy (a service wrapper respawn blocking port reclaim) |
| 3a5658952 | b2 | REF unlink-while-open-ebusy (reclaiming leftover listeners after self-update) |
| 7b6f4f4ec | b3 | REJECT refactor (merge commit) |
| 81518016b | b2 | REJECT repo-specific (CI lane) |
| 0a051501f | b2 | REJECT test-only |
| 13bbe72df | b3 | REJECT test-only |
| 6621ac961 | b2 | REF process-exit-fastfail-0xc0000409 (awaiting worker exit before isolate reclaim) |
| 77eeb8184 | b2 | REJECT test-only |
| 2c83d6232 | b2 | REJECT repo-specific (CI lane) |
| b57c06266 | b2 | REJECT repo-specific (CI lane) |
| 045fe4252 | b3 | REJECT test-only |
| 208cbe0f9 | b3 | REJECT test-only |
| 20d72015d | b2 | REJECT repo-specific |
| 9cdb0da2e | b3 | REJECT test-only |
| 33caf3364 | b3 | REJECT test-only |
| 2eb749943 | b3 | REJECT test-only |
| 993e39a82 | b3 | REJECT test-only |
| 1b532c4e0 | b3 | REJECT test-only |
| 217db0426 | b2 | REJECT test-only |
| 3e95ba33f | b3 | REJECT test-only |
| 98d257677 | b3 | REJECT test-only |
| de60ea5a3 | b2 | REJECT test-only |
| ef84c3ef0 | b2 | REJECT repo-specific (CI lane) |
| 2c385d0c4 | b2 | REJECT repo-specific (CI lane) |
| 12eae74ec | b3 | REJECT refactor (merge commit) |
| 1df9c82c5 | b3 | REJECT refactor (merge commit) |
| 51d9c5621 | b2 | REF pathext-exe-beats-cmd (setting Path so release shims win) |
| 0af17fbfd | b2 | REF spawn-npm-enoent-einval (routing gh and release commands through a shared launcher) |
| 356924263 | b2 | REJECT repo-specific (CI lane) |
| bb95d8c88 | b2 | REF startup-artifact-is-not-a-process (verified PID kills rather than trusting a stop) |
| ccc4d40a9 | b2 | REJECT repo-specific |
| e0bae5392 | b2 | REF windowstyle-hidden-vs-windowshide (VBS launcher install hardening) |
| 2ca83754d | b2 | REF unlink-while-open-ebusy (isolating the tray host from proxy sockets) |
| e42805874 | b3 | REJECT test-only |
| 1d9e196e7 | b2 | NEW localized-cli-output-parsing |
| a35450e0b | b3 | REJECT test-only |
| c809af030 | b3 | REJECT test-only |
| 93c84917f | b3 | REJECT test-only |
| 256ed1a90 | b2 | REF unlink-while-open-ebusy (same fix, second branch) |
| 7a98372e2 | b3 | REJECT test-only |
| 2cc2ee31d | b2 | REF localized-cli-output-parsing (same fix, second branch) |
| 5bf66df26 | b3 | REJECT test-only |
| 9e4d034d9 | b3 | REJECT refactor (merge commit) |
| e3fd0db24 | b3 | REJECT test-only |
| 438b8dcf4 | b2 | REF localized-cli-output-parsing (encoding round-trip: escaped needle never matches the export) |
| 34688f641 | b3 | REJECT test-only |
| 93385503e | b3 | REJECT test-only |
| b9ae6592d | b2 | REF execution-policy-file-block (tightening the scheduler elevation boundary) |
| cdc16e5a7 | b2 | REF localized-cli-output-parsing (classifying a localized scheduler denial) |
| b7c678c0d | b2 | REJECT repo-specific |
| 341d4863a | b2 | REJECT repo-specific |
| 0e78e4d59 | b2 | NEW icacls-inheritance-r-empty-dacl (re-audit: was REJECT repo-specific) |
| ddc597f4e | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| b1713b574 | b2 | NEW tcp-tcb-survives-listener (re-audit: was REJECT repo-specific) |
| c266124de | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 3ab6c6314 | b2 | REF localized-cli-output-parsing (task XML validation hardening) |
| 753c3231a | b2 | NEW file-url-encodes-backslash (re-audit: was REJECT repo-specific) |
| 3c904f9fc | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 93685c11d | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 31e065f98 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 9e39c3270 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 5efbba0f3 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 7a0810d1f | b2 | REF localized-cli-output-parsing (same, duplicated branch) |
| f84622f35 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 447652a3f | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 7813eb76a | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| e479434cf | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 25ae44f3f | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| b657e3393 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 55bc334d8 | b2 | REF localized-cli-output-parsing (same, duplicated branch) |
| 92122bf0f | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 26686a9f7 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 955ca0334 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 07fab277a | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 58540fcb0 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| fa4ed8e1a | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| fbb0f9b7c | b2 | REF localized-cli-output-parsing (same, duplicated branch) |
| e3e0ca2b0 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| faaeebba8 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 000ddd002 | b2 | REF localized-cli-output-parsing (false unhealthy task diagnostics) |
| fe146fee8 | b2 | REF env-domain-principal (aligning service and tray with the Codex home) |
| 74e274765 | b2 | REF env-domain-principal (following the active Codex home for the tray listener) |
| 2a5082512 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| c48a6eee3 | b3 | REJECT test-only |
| 0cb977666 | b2 | REF path-dot-hijacks-bare-npm (preventing update cwd command hijacking) |
| f9c5ceb42 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 475c3478f | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 762c7e5e8 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| e95d72914 | b2 | REF localized-cli-output-parsing (same, duplicated branch) |
| 19c5a720f | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| fda202cd9 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| d482086bf | b2 | REF env-domain-principal (owner ACE before inheritance removal) |
| 8c3c34974 | b2 | REJECT repo-specific |
| 261abb7ff | b2 | REF unlink-while-open-ebusy (observing external retention) |
| 5172faf8c | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 585188070 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 8a0086b8c | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| d48fd7df6 | b2 | REF localized-cli-output-parsing (same, duplicated branch) |
| 6cc5b51a3 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 9e7d78b31 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 45bf88cbc | b3 | REJECT test-only |
| 629b6767a | b3 | REJECT test-only |
| 5ff20dc00 | b2 | REJECT repo-specific |
| 6577b81ad | b3 | REJECT test-only |
| 26d6a70ab | b2 | REJECT repo-specific |
| 262a900d9 | b1 | REF dollar-backslash-vars (literal backslashes destroyed by escape repair) |
| 78562d1ca | b2 | REJECT repo-specific |
| b0e40b8bb | b3 | REJECT test-only |
| 1f3eddac3 | b3 | REJECT test-only |
| 11a3ba049 | b2 | REJECT repo-specific |
| fe1601791 | b3 | REJECT test-only |
| ceba77978 | b2 | REJECT repo-specific |
| ba0194b04 | b3 | REJECT test-only |
| 857a4d575 | b2 | REJECT repo-specific |
| 911373dbb | b3 | REJECT test-only |
| e733fbb5f | b2 | REJECT repo-specific |
| 3ba899b36 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 81a6a9560 | b2 | REJECT repo-specific |
| a7e0feca3 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 0b9cefe2c | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 29645921a | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| dca6ed983 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 96511892c | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| 13a870a7a | b2 | REJECT repo-specific |
| 68b8c6918 | b3 | REJECT test-only |
| 96700e6a3 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| efa8fd9ad | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| ba5f8c780 | b2 | REJECT repo-specific (Go port of an existing Windows surface; no new mechanism) |
| cacd6c365 | b2 | REJECT repo-specific |
| 59bc0b7b2 | b2 | REJECT repo-specific |
| 61b18541f | b3 | REJECT refactor (merge commit) |
| 75af635c7 | b2 | REJECT test-only |
| df1480d80 | b3 | REJECT test-only |
| dc52f1ffb | b2 | REJECT repo-specific |
| 5f4d837ae | b2 | REJECT repo-specific |
| 2ad1130f9 | b2 | REJECT repo-specific |
| d5432d5a9 | b2 | REJECT repo-specific |
| c1ecbe1b5 | b2 | REJECT repo-specific |
| a2c8cd35d | b2 | REJECT repo-specific |
| 4e0d67356 | b2 | REJECT repo-specific |
| eb81a26ce | b2 | REJECT repo-specific |
| f5d8c00df | b2 | REJECT repo-specific |
| b4d22f10d | b2 | REJECT repo-specific |
| 6d4cf8594 | b3 | REJECT test-only |
| e246b9d10 | b2 | REJECT test-only |
| 0a8e1c662 | b3 | REJECT test-only |
| dd40e3181 | b2 | REJECT repo-specific |
| 77b966ca6 | b2 | REJECT repo-specific |
| b49637021 | b3 | REJECT test-only |
| bef8c40d3 | b3 | REJECT test-only |
| b5f81ac4b | b2 | REJECT test-only |
| 3183a990c | b2 | REJECT repo-specific |
| a676f80b5 | b2 | REJECT repo-specific |
| 5605c6e20 | b3 | REJECT test-only |
| d25f02360 | b2 | REJECT repo-specific (CI lane) |
| 088a4174d | b2 | REJECT repo-specific (CI lane) |
| b5f627550 | b1 | REF ps-file-extension-dispatch (codex.cmd enable args in a CLI fixture) |
| d4680905f | b3 | REJECT test-only |
| fe1a5ea2c | b1 | NEW basename-split-slash-only |
| cac119250 | b1 | REF unlink-while-open-ebusy (visible EPERM skip in a hooks install) |
| fbb2fce71 | b3 | REJECT test-only |
| 32593510f | b3 | REJECT test-only |
| 1f55000b3 | b3 | REJECT test-only |
| 47072be35 | b3 | REJECT refactor (merge commit) |
| 464fd7d43 | b3 | REJECT refactor (merge commit) |
| 21e58b09e | b2 | REJECT repo-specific |
| 84d601f93 | b3 | REJECT test-only |
| 484fb7175 | b2 | REJECT test-only |
| 810fa1152 | b2 | REJECT test-only |
| 22561a459 | b1 | NEW lf-pure-transform-mixes-eol |
| ad5c1d9bf | b3 | REJECT refactor (merge commit) |
| 9b15ec191 | b3 | REJECT refactor (merge commit) |
| 6b5daee0d | b2 | REJECT repo-specific |
| 5b8e9e284 | b2 | REJECT repo-specific |
| d9ba82e9c | b1 | REF lf-pure-transform-mixes-eol (CRLF and inline-comment coverage) |
| bb3826e5f | b2 | REJECT repo-specific |
| 3ba754df7 | b2 | REJECT test-only |
| b2921e82d | b2 | REJECT repo-specific |
| b4f7f30a1 | b2 | REJECT repo-specific |
| 1dfff9b00 | b2 | REJECT repo-specific |
| a728bcb47 | b2 | REJECT repo-specific |
| 3f448e58a | b2 | REJECT repo-specific |
| e875dd797 | b2 | REJECT repo-specific |
| f2deaa092 | b2 | REJECT repo-specific |
| 4f7616092 | b2 | REJECT repo-specific |
| 8fdd5fbb9 | b2 | REJECT repo-specific |
| 5e514ee01 | b2 | REJECT repo-specific |
| f65de982a | b2 | REJECT repo-specific |
| aac6ce784 | b2 | REJECT repo-specific |
| 45861703c | b2 | REJECT repo-specific |
| 14c2a55d4 | b2 | REJECT repo-specific |
| d83f10ebf | b2 | REJECT repo-specific |
| 34f1a0084 | b2 | REJECT repo-specific |
| fdf4ba4bd | b2 | REJECT repo-specific |
| 63cac5821 | b2 | REJECT repo-specific |
| 88050b447 | b2 | REJECT repo-specific |
| 34a19a598 | b2 | REJECT repo-specific |
| 62edb7b66 | b2 | REJECT repo-specific |
| a9dd24f08 | b2 | REJECT repo-specific |
| 91f087596 | b2 | REJECT repo-specific |

## Judgment calls

- The Go port block was rejected wholesale as repo-specific after reading ten of
  them. **The follow-up round re-audited it in full and the judgment was wrong.**
  A dispatched explorer ran `git patch-id --stable` across the 44 rows labeled as Go-port work
  and found they collapse to SEVEN unique patches, each repeated up to eight
  times across branches — so the original call had only seven diffs to be right
  or wrong about, and a sample of ten was mostly re-reading duplicates.

  Three of the seven carry mechanisms the corpus did not own, and all three are
  now cases: `icacls-inheritance-r-empty-dacl` (0e78e4d59),
  `tcp-tcb-survives-listener` (b1713b574), and `file-url-encodes-backslash`
  (753c3231a). The other four hold: WinSW-versus-scheduler selection is product
  surface with a USERDOMAIN anti-pattern `env-domain-principal` already owns;
  task-XML validation is the workaround `localized-cli-output-parsing` teaches;
  the tray's HideWindow and DETACHED_PROCESS flags are
  `windowstyle-hidden-vs-windowshide`; and the WinSW status greps are the same
  localized-output trap.

  The lesson is about the sampling method rather than about Go: when an
  inventory contains cherry-picked or re-landed commits, "read a sample of the
  block" samples the branches, not the patches. Deduplicating by patch-id first
  costs one command and makes the sample meaningful.
- The ACL and SID work (a dozen rows) all REFs `env-domain-principal` rather
  than producing a new case. Resolving the effective token SID instead of
  trusting USERDOMAIN and USERNAME is exactly that case's sentence, and the
  variations — ARM64 lookup, owner ACE ordering, fail-closed classification —
  are the same mechanism met at different call sites.
- `9122d5ebe` was the closest call, and the follow-up round SPLIT it. It is now
  `known-folder-empty-not-error` rather than a ref on
  `redirected-ps-output-mojibake`. Re-reading the diff settled it: the mojibake
  case is a value destroyed in transit by a console codepage, and this one is an
  API answering an empty string instead of failing when it resolves through
  USERPROFILE to a profile with no AppData directory. Different sentence,
  different fix (base64 framing versus the known-folder registration), different
  reader — one is debugging garbled characters, the other a path that silently
  became relative.
