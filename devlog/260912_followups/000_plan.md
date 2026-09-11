# 260912 follow-ups — plan

## Summary for a reader who was not here

The win-hooks round landed on local `main` and stopped there, leaving three things
the user then approved together: publish it, fix the one retrieval gap the round
admitted to, and go back to the 24 win-hooks entries the round rejected to check
whether the rejection still holds.

Nothing here adds scope to the corpus by default. Two of the three phases could
legitimately end in "no change, and here is why" — the retrieval fix is the only one
with a guaranteed deliverable.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | satisfy-spec, three independent follow-ups under one goal |
| Trigger | User approved all three artifact follow-ups offered after the win-hooks round |
| Goal | Round published with CI green, preflight returning the right case, and a recorded verdict on all 24 rejected entries |
| Non-goals | No new ontology vocabulary. No validator changes. No redesign of the fp scoring model beyond what the target query needs. No padding the corpus with weak cases to make phase three look productive |
| Verifier | `bun scripts/lint-cases.mjs`, `build-graph` + `validate-graph`, `install-skill --check`, before/after `fp preflight` output, and the GitHub Actions run conclusion read from the API |
| Stop condition | wp3-remine's D closes with all six criteria carrying evidence |
| Memory artifact | `devlog/260912_followups/` |
| Expected terminal outcomes | DONE = all three finished and pushed with CI green. BLOCKED = push refused or CI red for a reason outside this scope. A phase-three verdict of "all 24 still rejected" is DONE, not NOOP |
| Escalation condition | Any credential the session does not have, or a CI failure whose cause is in the existing site build rather than this work |
| Resource bounds | Write scope: `scripts/fp.mjs`, `cases/`, `ontology/concepts/`, `devlog/260912_followups/`, `README.md`, `skills/`. Push to `origin/main` is authorized for this unit and nothing else. No token or wall-clock budget was set by the user |

## Roadmap deviation, recorded

`LOOP-DOCS-FIRST-01` wants a docs-only roadmap cycle as the first work-phase of a
multi-cycle loop. This unit writes its whole roadmap inside wp1's P instead, because
wp1 is publication rather than implementation and blocking a push behind a separate
documentation cycle would invert the user's stated priority. The roadmap still exists
in full before any implementation phase begins, which is what the rule protects.

## Work-phase map

| Phase | Doc | Produces | Consumes |
|---|---|---|---|
| wp1-publish | `010_publish.md` | origin/main updated, deploy run green | the merged round |
| wp2-preflight | `020_preflight.md` | `fp.mjs` change + before/after evidence | a published baseline |
| wp3-remine | `030_remine.md` | verdict table for all 24 rejected entries | the corrected engine |

Ordered by what each consumes: publishing establishes the baseline CI signal, the
engine fix changes how cases are retrieved, and re-mining is judged against that
corrected retrieval.

