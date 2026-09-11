# wp2-preflight

## The gap

`bun scripts/fp.mjs preflight --runtime node --operation spawn --target python`
returns the npm/PATHEXT cluster and does not return
`windowsapps-python3-stub-needs-probe`, which is the single most relevant case for
"I am about to spawn python on Windows".

The previous round diagnosed it: preflight scores a case by the `Command` node named
in the query's `--target`, and that case declares `invokes: [command-where]` because
`where.exe` is what the repro uses. The case is right and the retrieval is wrong.

## Plan

1. **Read `scripts/fp.mjs` first** and record how `preflight` actually scores, with
   line numbers: how `--target` maps to a node, what contributes weight, and whether
   operation and runtime filter or merely rank. No change is designed before that.
2. **Capture a before baseline** for a set of queries, not just the failing one:
   the target query, plus at least `spawn/npm`, `encoding`, `exit-code` and
   `env-path` queries that currently return sensible answers. Save the output.
3. **Make the smallest change that closes the gap.** Candidates, to be chosen against
   the code rather than in advance: let a target name match a case's subject matter as
   well as its `invokes` edge; give `affects` a runtime contribution when the target
   names a runtime; or let a target string match the case title and ontology labels at
   a lower weight than an exact `invokes` hit. Prefer whichever changes ranking
   without changing what counts as a hit.
4. **Capture after output for the same queries** and diff them. The target query must
   gain the case; every other query must be identical or defensibly better.
5. If no change can do both, say so and leave the engine alone. A retrieval gap
   honestly recorded beats a scoring model bent to pass one query.

## Scope boundary

IN: `scripts/fp.mjs`. OUT: case frontmatter, the ontology vocabulary, the validators.
Editing the case's `invokes` to add a python command would make the query pass and
would be a lie about what the repro runs — explicitly rejected.

## Accept criteria

- Before/after output for the target query, showing the case absent then present.
- Before/after for the control queries, showing no regression.
- `lint-cases`, `build-graph`, `validate-graph` still exit 0.

