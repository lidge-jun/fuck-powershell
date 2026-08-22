# 070 — Round closeout

## What shipped

522 commits dispositioned across five repositories, 16 new cases, 54 -> 70.
The ontology grew from 211 nodes and 428 edges to 251 and 526, and the
case-to-mechanism ratio stayed healthy: 16 cases introduced 14 new concepts, so
the graph did not inflate with near-duplicates.

| wp | repo | inventory | NEW | REF | REJECT |
|---|---|---|---|---|---|
| wp1 | codexclaw | 28 | 2 | 0 | 26 |
| wp2 | cli-jaw | 63 | 5 | 15 | 43 |
| wp3 | ima2-gen | 72 | 4 | 16 | 52 |
| wp4 | agbrowse | 18 | 1 | 1 | 16 |
| wp5 | opencodex | 341 | 5 | 61 | 275 |

## What the numbers say

The REF column is the one worth reading. agbrowse contributed a single case and
a single ref; opencodex contributed 61 refs. That asymmetry is the
dependency-ordered work-phase map doing its job — by the time the largest
inventory ran, four repos' worth of mechanisms already existed to attach evidence
to, so a commit that would have become a thin duplicate case in a parallel round
became cross-repo evidence for an existing one instead.

The other visible pattern: yield does not track inventory size. codexclaw's 28
rows produced two cases; opencodex's 341 produced five. Mining a repo that has
already been mined, or one with no Windows lane, is mostly a REJECT exercise, and
the coverage gate is what makes that an honest result rather than a quiet one.

## What the process caught

Three defects that would have shipped without the gates:

1. **The skill-drift gate was red before the round started.** `build-skill.mjs`
   walked cases with an unsorted `readdirSync`, so its output could reorder
   between runs, and a committed `\,` corruption in a case title was being
   silently rewritten on every regeneration. The A-phase reviewer found it by
   running the gate instead of trusting the plan (PLAN-VERIFIER-REAL-01).
2. **A transposed SHA in the ima2-gen table.** `check-coverage.mjs` failed with
   1/72 missing and named the row. The prior rounds' coverage claim was a
   remembered shell one-liner, which would not have caught it.
3. **A case whose Repro reproduced a different case.** The wp2 reviewer read
   `npm-script-runs-under-cmd`'s repro and recognized it as
   `cmd-posix-env-prefix`. The case was correct; its evidence was not.

## Corrections carried

The wp0 plan claimed repository coverage when the inventories are subject-line
greps. That claim is now a stated non-goal: this round covers 522 frozen rows,
not five repositories. A Windows fix whose subject says "handle junction points"
is still invisible, and a future round that wants those has to change the
discovery method rather than the gate.

Two prior-round REJECTs were overturned under the new visible-overturn rule, both
because the earlier reason was scope ("not PS/shell-spawn") rather than
correctness. The project's scope widened from PowerShell to the whole Windows
interop surface, and the ledger says so rather than quietly re-adding them.

## Analyst lanes

Five `xai/grok-4.6` explorer lanes were dispatched in parallel. One returned
(codexclaw, 28/28 with both proposals surviving main-agent re-verification). Four
produced nothing across repeated wait cycles and were retired under
DISPATCH-RETIRE-01; the main agent read those inventories directly. The two
reviewer lanes both returned substantial verdicts, which is the split worth
remembering: bounded audit tasks came back, open-ended mining tasks did not.

## Open for a future round

- Reserved device names (CON, NUL, COM1-9) and MAX_PATH have no evidence in these
  five histories. Both are real Windows mechanisms the corpus still lacks.
- `9122d5ebe` (a known-folder lookup returning an empty string rather than an
  error) is REFed but could reasonably be its own case with a proper repro.
- The Go-port block in opencodex was rejected wholesale after reading ten of
  roughly forty. Cheap to re-audit if that judgment looks wrong later.
