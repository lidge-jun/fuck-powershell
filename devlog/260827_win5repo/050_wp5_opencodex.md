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

## Disposition table

Filled during B.
