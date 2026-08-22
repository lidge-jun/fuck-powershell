# 020 — wp2 cli-jaw

Inventory: inv/win_cli-jaw.txt, 63 SHAs, Tier A grep, prior-round SHAs excluded.

## Why the bar is hardest here

cli-jaw has been mined twice. The 260823 round took 46 commits and produced 7 NEW
cases plus 15 ref appends; the 260824 round took 19 more and produced 8 NEW.
Those rounds harvested the obvious Windows work. What remains in this 63-row
residue is by construction either subtler or already covered, so REF and REJECT
should dominate and every NEW proposal deserves extra suspicion.

Cases cli-jaw already owns, the primary dedupe targets: piped-iex-drops-params,
cmd-posix-env-prefix, cmd-start-ampersand-splits, explorer-exits-one,
node-path-host-delimiter, spawn-npm-enoent-einval, write-host-not-success-stream,
cmd-shim-reparses-argv, irm-iex-kills-host, npm-ps1-not-comspec,
envpath-pollutes-user, command-v-noop, ps-file-extension-dispatch,
dq-regex-interpolates, strictmode-missing-property.

## Surfaces worth checking

cli-jaw ships an installer, a service manager, and a shell-integration layer —
the three surfaces where Windows semantics leak hardest.

1. Installer and bootstrap. irm-pipe-iex flows, execution policy, PATH mutation,
   and the .ps1 contract tests. irm-iex-kills-host, envpath-pollutes-user,
   execution-policy-file-block, and session-path-stale already cover much of it.
   A NEW case needs a mechanism outside those four.
2. Service and daemon registration. sc.exe, scheduled tasks, service accounts,
   and USERDOMAIN-derived identity. env-domain-principal owns the identity half;
   service-control exit-code semantics are uncovered ground.
3. Shell integration. Profile loading, prompt hooks, completion scripts. The
   corpus has no case about profile load order or about a profile that silently
   does not load under -NoProfile in CI.
4. Terminal and console. Console allocation, ANSI handling, window style.
   windowstyle-hidden-vs-windowshide and bun-ps-windowstyle-argv own the
   window-style pair; raw-mode and VT-sequence behavior is uncovered.

## Expected shape

Two to five NEW from 63 rows, weighted toward the service and console surfaces
the earlier rounds did not examine. An all-REF/REJECT residue is a legitimate
NOOP for this work-phase, and the ledger proves it.

## Build steps

Same as wp1: verify every cited diff, write accepted cases with full ontology
blocks, append refs, fill the 63-row table, regenerate, validate.

## Acceptance

- 63 of 63 SHAs dispositioned.
- Gate chain green.
- No NEW case duplicates any of the 15 cli-jaw-derived cases listed above.

## Analyst lane retired

The dispatched grok-4.6 lane produced nothing after ~30 minutes across four wait
cycles. Per DISPATCH-RETIRE-01 that is a failed dispatch, not a slow one, so the
main agent read the 63 diffs directly. Every NEW case below cites a diff the main
agent read in full.

## Yield

Five NEW, which is above the two-to-five expectation. The reason is visible in the
inventory: cli-jaw did a concentrated native-Windows push in August 2026 — a
shell-free launch resolver, a service backend, a release lane — and those three
surfaces were exactly the ones the prior two rounds had not looked at. The
installer surface, which they DID mine, produced nothing new here, which is the
dedupe bar working.

| id | category | mechanism |
|---|---|---|
| bomless-bat-oem-codepage | encoding | cmd.exe reads a BOM-less .bat in the OEM codepage, and a BOM fuses onto line 1 instead of fixing it |
| npm-script-runs-under-cmd | ci-agents | npm runs package scripts through ComSpec on Windows, so POSIX shell syntax in a script string arrives as literal text |
| wslenv-shared-with-host | env-paths | WSLENV is the interop config variable and is set on the Windows side, so it cannot detect WSL |
| startup-artifact-is-not-a-process | exit-codes | Windows autostart has no supervisor, so registration state and run state are independent facts |
| shell-true-fallback-injects | args-quoting | the shell:true fallback that fixes ENOENT/EINVAL re-parses argv, turning user text into a second command |

No ref appends: the five prior cli-jaw cases the earlier rounds wrote
(irm-iex-kills-host, envpath-pollutes-user, command-v-noop,
ps-file-extension-dispatch, dq-regex-interpolates) own installer and
shell-integration ground that this residue does not re-evidence.

## Disposition table

| sha | disposition |
|---|---|
| 22bff5292 | REF spawn-npm-enoent-einval (npm.cmd EINVAL in the release sync; same mechanism, resolves npm-cli.js under node) |
| 75e8e75cb | REF spawn-npm-enoent-einval (same fix, second branch) |
| ea5bc3136 | REJECT docs-only |
| 8081a7294 | REJECT docs-only |
| e7b5f9a0a | REJECT repo-specific (CI lane plumbing) |
| 955d2b3f7 | NEW startup-artifact-is-not-a-process + NEW bomless-bat-oem-codepage |
| 3037f98c2 | REJECT repo-specific (require() in an ESM module; not Windows-native) |
| 3d41b3f9a | REJECT repo-specific (CI trigger matrix) |
| b9a24d191 | REF envpath-pollutes-user (persistent User PATH via bootstrap) |
| 017065e23 | REF startup-artifact-is-not-a-process (adds the Startup-folder and Scheduled Task backend the case is about) |
| 516e19d2d | REF shell-true-fallback-injects (spawn-site gating, same mechanism) |
| 052660382 | REJECT docs-only |
| 6e385bf9a | REJECT docs-only (structure doc sync for the same change) |
| 8f294b449 | NEW shell-true-fallback-injects |
| b8204d5ab | REJECT repo-specific (envDelta plumbing through migrated call sites) |
| f6884c23d | REF shell-true-fallback-injects (routing remaining sites through the resolver) |
| 9901e6a59 | REJECT test-only |
| a9ac34c24 | REJECT no-windows-mechanism (UTF-8 lone-surrogate hash collision; a JS string-encoding fact, not a Windows one — see judgment calls) |
| 4211080b8 | REJECT docs-only |
| 56381201a | REJECT test-only |
| 095b9a057 | REJECT test-only |
| 663b27ca5 | REF pathext-bare-name-enoent (shebang interpreter discovery inside the resolver) |
| 43713c32d | REF spawn-npm-enoent-einval (standard spawn path through the shell-free resolver) |
| eb6449f32 | REF spawn-npm-enoent-einval (the resolver itself: PATH x PATHEXT walk plus ComSpec hop for .cmd) |
| 16b9dfc39 | REF execution-policy-file-block (registry fallback when the PS security module cannot load) |
| 43d4953ca | REF execution-policy-file-block (install diagnosis surfacing the same gate) |
| 38e728fdb | REJECT docs-only |
| 14b6f4e46 | REJECT repo-specific (ssh invocation contract) |
| 4cf98685d | REJECT test-only |
| 8fbfa94ba | REJECT docs-only |
| c6a979622 | REJECT docs-only |
| 034ed93e2 | REJECT docs-only |
| c94bcd9c9 | REJECT docs-only |
| 9f7429d80 | REJECT docs-only |
| 09245ec87 | REJECT repo-specific (changes the runtime prompt template and adds a skill contract test, not only docs) |
| 7f413890c | REJECT repo-specific (Computer Use window-scoped API) |
| bd0b4c205 | REF ps-file-extension-dispatch (launching JS through node rather than the shim) |
| 998dfe48a | REF ps-file-extension-dispatch (same fix, earlier branch) |
| 5d417edb8 | REJECT repo-specific (dist asset shipping) |
| 460b4f74c | REJECT refactor (merge commit) |
| 4eb4455e3 | REF pathext-exe-beats-cmd (narrowing the Windows extension allowlist) |
| 18d6260e1 | REJECT refactor (merge commit) |
| b357532a4 | REF get-command-where-disagree (real where.exe cases in the Windows lane) |
| 36795a449 | REF wslenv-shared-with-host (consumer of the classifier; same mechanism) |
| beb1142f6 | REF pathext-exe-beats-cmd (a bun .exe outranking every npm .cmd) |
| b90caa70c | REJECT refactor (production browser-open.ts moves from existsSync to an injected probe; behavior unchanged) |
| 4a2bbefd2 | NEW wslenv-shared-with-host |
| ddb347bf1 | NEW npm-script-runs-under-cmd |
| 69248a5a2 | REF spawn-npm-enoent-einval (win32 .cmd shell spawn) |
| 332b8027c | REF spawn-npm-enoent-einval (app server cmd shims) |
| c35b70c5d | REJECT repo-specific (runner pinning) |
| 4e5efd210 | REJECT repo-specific (rsync absent in Git Bash; a toolchain availability fact, not a platform semantic) |
| 600ab263b | REJECT repo-specific (rejects a Windows HOME and Windows fnm/nvm paths inside WSL — an inherited-environment problem, not the WSLENV mechanism) |
| bf9c3785b | REJECT repo-specific (same fix, second branch) |
| 2fa5c2444 | REF wslenv-shared-with-host (originating evidence: the commit that put WSLENV into the detection predicate) |
| a20dd9219 | REF wslenv-shared-with-host (same fix, second branch) |
| 71e25c286 | REJECT no-windows-mechanism (gemini quota time windows; matched the grep on the word "windows") |
| da074ceba | REJECT no-windows-mechanism (same) |
| 50774f2bb | REJECT no-windows-mechanism (EG search windows; same word collision) |
| c2ea82099 | REJECT no-windows-mechanism (same) |
| 33340274b | REJECT docs-only |
| 1c3a4f86a | REJECT docs-only |
| 91197a9eb | REJECT docs-only |

## Judgment calls

- `a9ac34c24` was the hardest REJECT. The commit is genuinely about Windows —
  paths and command lines are UTF-16, so a hash that maps unpaired surrogates to
  U+FFFD collides over the real input domain. But the mechanism is a property of
  JS string-to-UTF-8 conversion, reproducible identically on macOS; Windows only
  supplies the input domain that makes it reachable. Under the generalizability
  bar that is a runtime fact, not a Windows one. Recorded here because a future
  round may reasonably disagree.
- `4e5efd210` (rsync missing in Git Bash) is a packaging fact: the tool really is
  absent from that environment. It is NOT `command-v-noop`, which is the opposite
  situation — a tool that IS installed looks missing because `command -v` is a
  no-op in PowerShell. Rejected on its own terms with no case cited.
- The wslenv rows were re-dispositioned during the A-gate audit. Only
  `4a2bbefd2` — the canonical classifier that names WSLENV as the deliberately
  excluded signal — is NEW. `2fa5c2444` introduced the false positive and
  `36795a449` consumes the classifier, so both are REF evidence for the same
  mechanism. The two `install-wsl.sh` commits reject a Windows HOME and Windows
  node paths inside WSL, which is an inherited-environment problem with a
  different sentence, so they lost their REF and became repo-specific.
- `017065e23` was initially REJECTed as repo-specific while its own decade doc
  said the mechanism was captured by `startup-artifact-is-not-a-process`. If the
  mechanism is captured, the verb is REF. Corrected.
- `09245ec87` and `b90caa70c` had wrong REJECT reasons: the first changes a
  runtime prompt template and adds a contract test, the second changes production
  source. Both remain rejections, with reasons that match their diffs.
- Four rows matched the grep on the English word "windows" (quota windows, search
  windows). They are dispositioned rather than silently dropped, which is the
  point of a frozen inventory.
- `955d2b3f7` yields two cases because the diff carries two independent
  mechanisms: the chcp comment documents the batch-codepage trap, and the
  lifecycle rewrite documents the supervisor-absence trap. Splitting them is
  correct under the reader's-situation test — someone hitting 9009 on a wrapper
  and someone whose status display lies are not the same reader.
