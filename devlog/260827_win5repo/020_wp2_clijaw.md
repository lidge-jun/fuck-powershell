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

## Disposition table

Filled during B.
