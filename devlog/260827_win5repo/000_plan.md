# 000 — Five-repo Windows mining (win5repo)

## Objective

Every SHA in the five frozen inventories under `inv/win_*.txt` receives exactly one
disposition — NEW case, ref append to the case that already owns that mechanism, or
an explicit REJECT row with a reason from the closed set. One repo per PABCD
work-phase, in the order codexclaw, cli-jaw, ima2-gen, agbrowse, opencodex. No
inventory is mined twice, and no mechanism is written twice.

**Non-goal, stated plainly:** this is NOT repository coverage. The inventories are
built by subject-line grep, so a Windows fix whose subject says "handle junction
points", "unlink while open", or "use the long-path prefix" is invisible to this
round. Closing 341/341 on opencodex means the 341-row inventory is dispositioned,
not that opencodex is mined out. Any later summary that says otherwise is wrong.

## Why this round exists

Two prior rounds mined narrowly. `260823_commit_mining` took a fix-grep slice of
four repos (103 commits) and `260824_issues_windows` took a second Windows slice
(95 commits) plus 18 submitted issues. Together they dispositioned 199 SHAs and
produced the current 54 cases. Neither round touched agbrowse at all, and both
capped their inventories by hand-filtered subject grep rather than a per-repo
coverage gate.

This round changes the unit of work rather than the discovery method: the
inventory is still subject grep, but it is frozen per repo BEFORE analysis, the 199
already-dispositioned SHAs are excluded mechanically, and each work-phase must show
ledger rows equal to its inventory line count. Coverage of the frozen slice is the
gate, not the case count. The grep limitation from the prior rounds is inherited,
not solved.

## Frozen inventories

Built by `git log --all` subject grep, minus the prior-round SHA prefixes:

| repo | inventory | tier |
|---|---|---|
| codexclaw | 28 | B (broad: spawn/path/encoding/exit-code + Windows terms) |
| cli-jaw | 63 | A (Windows-specific terms only; repo already mined twice) |
| ima2-gen | 72 | B |
| agbrowse | 18 | B (never mined before) |
| opencodex | 341 | A (largest history, 7458 commits) |

Tier A is the Windows/PowerShell-specific term set (windows, powershell, pwsh,
win32, cmd.exe, comspec, crlf, utf-16, cp949, codepage, lastexitcode, .ps1, .cmd,
.bat, execution-policy, drive-letter, unc, msys, cygwin, mingw, bom, backslash,
appexec, pathext, shebang). Tier B adds the POSIX-assumption surface (spawn, argv,
quoting, escaping, PATH, encoding, exit code, shell, EPERM/EBUSY/ENOENT/EINVAL,
cross-platform) for the three repos whose Windows work is not always labelled as
such in the subject line. Repos already mined twice keep Tier A so the inventory
stays reviewable.

The term list describes intent, not membership: a row can enter an inventory
because a term appears incidentally (`realpath` matches `path`), so the
authoritative definition of each inventory is the file itself, not this paragraph.

Exclusion is mechanical. `inv/_dis8.txt` holds 8-char prefixes of the 199
prior-round SHAs and each inventory was filtered against it with:

```
git log --all --date=short --pretty=format:'%H%x09%cd%x09%s' | grep -iE '<tier>' \
  | awk -v F=inv/_dis8.txt 'BEGIN{while((getline l<F)>0) d[l]=1} \
       {p=substr($1,1,8); if(!(p in d)) print}' > inv/win_<repo>.txt
```

8 chars is short for a 13340-commit combined history (birthday risk around 2%). It
was checked and does not bite on this slice: `git rev-list --all | cut -c1-8 |
sort | uniq -d` is empty in every one of the five repos, and no inventory SHA
prefix sits in `_dis8.txt`. Coverage checking uses FULL SHAs from the inventory
files, which store them, so the short prefix is confined to the one-time exclusion
step and is re-auditable with the command above.

Repo sizes for the record: opencodex HEAD is ~7463 commits and `--all` reaches
~13340 including merged PR branches; cli-jaw HEAD is 318 while `--all` is ~6865, so
its 63-row residue spans every remote branch, not just mainline.

## Work-phase map (dependency-ordered)

| wp | unit | doc | why here |
|---|---|---|---|
| wp0 | roadmap (this cycle, docs-only) | 000, 001 | inventories + dedupe method must be frozen before any case is written |
| wp1 | codexclaw | 010 | smallest inventory; validates the analyst packet and the gate chain end-to-end on 28 rows before spending it on 341 |
| wp2 | cli-jaw | 020 | next smallest; already twice-mined so its residue tests the dedupe bar hardest |
| wp3 | ima2-gen | 030 | mid-size, image/CLI surface distinct from the agent repos |
| wp4 | agbrowse | 040 | never mined; unknown yield, so it runs after the bar is calibrated |
| wp5 | opencodex | 050 | largest by an order of magnitude; runs last so every earlier mechanism is already in the corpus to dedupe against |
| wp6 | ship | 060 | issues + counts + push, only after all five ledgers close |

The order is the user's, and it is also the right build order: dedupe quality
depends on how much of the corpus already exists, so the biggest inventory should
meet the largest corpus. Each work-phase consumes the previous one's cases as
dedupe input.

## Scope

IN: `devlog/260827_win5repo/**`, `cases/**`, regenerated `ontology/**` and
`skills/**`, docs-site content generated from cases, README counts, and GitHub
issues registering new cases.

OUT: any source change to the five mined repos (read-only mining), docs-site visual
redesign, ontology schema changes, and rewriting existing cases beyond additive ref
appends.

## Per-work-phase acceptance

1. `bun scripts/lint-cases.mjs` exits 0.
2. `bun scripts/build-graph.mjs` then `bun scripts/validate-graph.mjs` report 0
   violations. Order matters: validate-graph checks the built graph against disk
   (V11), so running it without rebuilding first fails on any new case.
3. `bun scripts/build-skill.mjs` regenerates, and `git diff --stat -- skills/`
   afterwards contains ONLY the new category and case text. This gate was red
   before this round started: build-skill rewrote a committed `\,` corruption in
   `references/exit-codes.md` back to `LASTEXITCODE`. That regeneration is
   committed as a wp0 chore so the gate starts green, and `readdirSync` is sorted
   so file order cannot flop between runs.
4. `cd docs-site && bun run build` exits 0. That script — not bare `astro build` —
   is the site gate, because `build` = `graph` + `sync` (copies every case into
   `docs-site/src/content/docs/cases/`) + `astro build` (one route per case). The
   synced case pages are tracked and must be committed. A pre-existing
   `Entry docs -> 404 was not found` warning is expected and is not a regression.
5. Ledger disposition rows for that repo equal its inventory line count, checked by
   `scripts/check-coverage.mjs <repo>` (added in wp0), not by a remembered
   one-liner.
6. `repro:` honesty. There is no Windows host in this loop. A case whose repro was
   not executed on Windows uses `repro: historical` and cites the commit as
   evidence; `verified` is reserved for behavior actually observed. This is
   allowed, expected, and not a NEEDS_HUMAN escalation.

## Terminal outcomes

DONE — five ledgers closed, corpus/ontology/skill/site/README/issues consistent,
pushed public. NOOP for a repo — zero non-duplicate mechanisms, which still
requires the full ledger table proving every SHA was examined. BLOCKED — a gate
fails for a reason outside this repo. NEEDS_HUMAN — a case would require asserting
unverified Windows behavior with no reachable evidence.
