# 041 — ship record

## What landed

The corpus went from **98 cases to 108**, and the graph from 343 nodes / 717 edges to
**380 nodes / 794 edges**, with zero validator warnings. Ten cases were mined from
[LilMGenius/win-hooks](https://github.com/LilMGenius/win-hooks), an independent Windows
repair tool whose `AGENTS.md` numbers 34 failures it detects and fixes.

| case | category | repro |
|---|---|---|
| `ps-quoted-path-is-expression` | args-quoting | verified |
| `msys-rewrites-slash-args` | args-quoting | verified |
| `cmd-star-ignores-shift` | args-quoting | verified |
| `cmd-rem-substitutes-parameters` | parsing | verified |
| `cmd-bom-displaces-label` | encoding | verified |
| `autocrlf-shebang-cr` | encoding | historical |
| `config-string-eats-windows-path` | parsing | verified |
| `caller-picks-interpreter-not-shebang` | env-paths | verified |
| `bash-on-path-may-be-wsl` | aliases | historical |
| `windowsapps-python3-stub-needs-probe` | env-paths | verified |

Plus 27 new ontology nodes and one edit to an existing one.

## How it was decided

Five `xai/grok-4.6` subagents did work the main session did not: four dedupe-checked
every candidate against all 98 existing cases with `fp search` and `rg`, and a fifth
audited the roadmap adversarially and returned **FAIL with 13 defects**.

That audit is the reason this round is worth anything. Rather than argue with it, every
disputed claim was measured on the machine — three probe rigs in `evidence/`, output in
`001_audit_and_measurements.md`. The measurements settled it in both directions:

- **The reviewer was right** about the batch-label rule (leading spaces and tabs are
  fine; a BOM is not whitespace), about the WSL title being false on any machine with
  Git for Windows, about "the kernel" not reading shebangs, and about two borrowed
  mechanism nodes describing a different failure than the one being filed.
- **The reviewer was wrong** about `REM`, and so was the original plan. `&`, `|`, `>`
  and unbalanced quotes inside a `REM` are all inert. What is not suppressed is batch
  parameter substitution, and a `%~` form that cannot resolve is fatal. Eight measured
  rows, six of them green.
- **One case was deleted.** `silent-timeout-kill-seconds-unit` survived dedupe and then
  failed this round's own scope rule: a host's timeout unit and a host's silent kill are
  host policy, the class the plan had already excluded. Dropping it was cheaper than
  defending it.

Three rounds of audit: FAIL, GO-WITH-FIXES, PASS.

## Two bugs found in this repository's own toolchain

Not planned, and not optional — both were discovered at the integration gate and both are
instances of landmines this corpus already documents.

`scripts/sync-cases.mjs` anchored its frontmatter match on `^---\n`. On a checkout with
`core.autocrlf=true` that matches nothing, so every CRLF case file fell through a
`continue`. Because the script `rmSync`s its output directory first, running it **deleted
90 docs-site case pages and rewrote only the 14 LF files**, silently, exit 0. The docs
site would have shipped missing 90 cases.

`scripts/build-skill.mjs` had the same anchor in its frontmatter-stripping `replace`. On
CRLF it stripped nothing, so every generated skill reference shipped the raw YAML block it
was meant to remove — the agent-facing artifact, polluted in all ten category files.

Both are fixed and both carry a comment explaining why the `\r?` is load-bearing.
`lint-cases.mjs` already had this fix, with a comment saying the `\n`-only anchor
"reported every case as missing frontmatter — a vacuous global failure that looked like a
corrupt corpus". These two were worse, because they failed quietly.

**This was a scope deviation.** `000_plan.md` ruled out changing `lint-cases.mjs`,
`build-graph.mjs` and `validate-graph.mjs`; it did not mention these two, and leaving
them broken would have made criteria c5 and c6 false while appearing to pass. Recorded
here rather than folded in quietly.

## Gates

```
bun scripts/lint-cases.mjs        -> 108 cases OK                                    exit 0
bun scripts/build-graph.mjs       -> graph: 380 nodes, 794 edges                     exit 0
bun scripts/validate-graph.mjs    -> 108 cases, 380 nodes, 794 edges, 0 warns        exit 0
bun scripts/build-skill.mjs       -> 10 reference files, 108 cases, no leaked YAML
bun scripts/sync-cases.mjs        -> 108 case pages, index with 10 categories
bun scripts/install-skill.mjs --check -> skill copy is in sync (11 files)            exit 0
```

Zero V10 warnings means every one of the 27 new nodes is actually referenced by an edge.

## What did not improve, and what would show this is wrong

`fp preflight --runtime node --operation spawn --target python` still returns the
npm/PATHEXT cluster and does **not** surface `windowsapps-python3-stub-needs-probe`.
Preflight scores on the target's Command node, and that case `invokes: [command-where]`
because `where.exe` is what the repro uses. So the case is correct and the retrieval is
not. That is an engine-tuning question about `fp.mjs`, deliberately left out of this
round, and it is the most likely place a reader will find this work insufficient.

Two claims in this round are attributed rather than measured, and both say so in the case
body: WSL's `bash.exe` exiting 0 after failing to open a Windows path (no WSL on this
host), and the `bad interpreter: ^M` failure itself (Git Bash tolerates the carriage
return, measured). If either turns out to be wrong, `bash-on-path-may-be-wsl` and
`autocrlf-shebang-cr` are the cases that would need retracting — which is exactly why
they are `repro: historical` and carry verification notes.

The dedupe ledger rests on subagent searches of an existing 98-case corpus. If a
duplicate slipped through, the most likely pair is
`cmd-bom-displaces-label` against `bomless-bat-oem-codepage`; they now carry a
`related_to` edge, so a future reader can judge whether they should be merged.

## First use of `related_to`

No case in the corpus used `related_to` before this round. Three case-to-case edges now
validate in the built graph, clustering the pairs whose relationship was previously prose
only. The spelling is `related_to: [case:<stem>]`, because `build-graph.mjs` names case
nodes `"case:" + stem`.

One edge is worth pointing at: `windowsapps-python3-stub-needs-probe` lists
`workaround-skip-windowsapps` as an **unsafe fix**, while `windowsapps-alias-eperm` still
lists it as a **mitigation**. Both are right. The path segment is the only discriminator
for "will `CreateProcess` refuse this binary", and the wrong test for "is this a working
interpreter". That node now carries a `## Why it's unsafe` section saying so — the
round's only edit to an existing concept.

