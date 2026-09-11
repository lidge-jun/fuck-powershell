# wp3-remine

## The question

The win-hooks round accepted 10 of 34 documented entries and rejected 24 in three
groups: that repository's own engine history, host policy rather than Windows, and
already covered here. The user asked whether any of the 24 deserve a case under a
different framing — particularly the host-policy group.

## Method

1. Re-read `AGENTS.md` at the pinned SHA for each of the 24, from the local clone.
2. For each, answer one question: **is the mechanism Windows' own?** A defect in
   win-hooks' patcher is not. A host's trust policy is not. A Windows behaviour that a
   host merely exposes **is**.
3. For anything that survives step 2, dedupe against all 108 existing cases with
   `fp search` and `rg` before accepting it.
4. Anything accepted needs a reachable public commit or PR, `repro: verified` if it
   can be measured on this machine and `repro: historical` with a verification note if
   it cannot.

## The one worth a second look

CASE-33 — a host silently skipping a hook whose manifest hash changed — was rejected
as host policy, and that rejection is probably right. But the neighbouring observation
is not host policy: a Windows `.cmd` shim cannot be executed by `spawnSync` directly,
which is why enumeration has to go through `cmd.exe /d /s /c`. The round recorded that
as already covered by `spawn-npm-enoent-einval` and `cmd-shim-reparses-argv`. Verify
that claim rather than inheriting it.

Similarly CASE-24's `awk '{print $1}'` returning the interpreter instead of the script
was filed as engine history. The generalisable part — that a command line's first token
is the interpreter, not the target, whenever an interpreter prefix is present — may be
a real agent-facing landmine that the corpus does not state.

## Expected outcome

A table covering all 24 with a verdict and a reason. **Rejecting all 24 again is a
legitimate and likely result**, and is to be recorded with reasons rather than padded
into weak cases. The round's own standard applies: a case needs a mechanism Windows
owns, a reproduction, and a citation someone else can check.

## Accept criteria

- All 24 entries appear in the table with a verdict.
- Any accepted case passes lint, graph validation and the citation rule.
- Any rejection names which of the three groups it falls into and why that still holds.

