# 001 — Dedupe and disposition method

## The failure mode this method exists to prevent

A corpus that grows by commit count instead of by mechanism count stops being
useful. Two cases describing the same underlying Windows behavior with different
cmdlets split the reader's search: whichever one they land on, they get half the
picture, and the ontology grows a duplicate mechanism concept that makes the graph
lie about how many distinct traps exist. The 54 cases currently map onto 36
mechanism concepts; that ratio is the health metric to protect.

## Mechanism identity test

Two commits describe the SAME mechanism when the sentence "the platform does X
instead of what POSIX habit expects" is the same sentence for both, even if the
command, the error string, and the call site differ.

Worked examples from the existing corpus:

- `oss-outfile-bom` and `utf8-bom-still-breaks-grep` are two cases, not one,
  because the first is "Out-File's default encoding is not UTF-8" and the second is
  "the documented fix still emits a BOM, and the parameter that would not does not
  exist on 5.1". Different sentence, different fix, both worth the reader's time.
- `tee-object-utf16` is separate from both because the cmdlet writes UTF-16 while
  the reader believes they are appending to a log they will grep — the double-grep
  failure is its own trap.
- `spawn-npm-enoent-einval` and `npm-ps1-not-comspec` are separate because one is
  extension DISPATCH (Node refuses .cmd after CVE-2024-27980) and the other is shim
  SELECTION (.ps1 wins the PATHEXT race). Same tool, two mechanisms.

Counter-examples that must be REF, not NEW: a second commit fixing the same
delimiter assumption at a different call site; the same exit-code propagation bug
found in a second script; the same mechanism reached through a different wrapper.

### Same sentence, different cmdlet

The encoding trio above shows that "different cmdlet" settles nothing by itself,
in either direction. The deciding question is whether the READER'S SITUATION
differs: does a person who already knows the existing case still walk into this
one? tee-object-utf16 survives that test because Tee-Object is the cmdlet you
reach for while trying to keep a log you can grep, and knowing that Out-File
defaults badly does not warn you about it. A second call site of the SAME cmdlet
with the same default fails the test.

Case identity is deliberately FINER than mechanism identity: 54 cases map onto 36
concepts, and all three encoding cases share caused_by mechanism-default-encoding.
Sharing a caused_by concept is therefore not evidence of duplication, and a NEW
case does not require a new concept.

## Disposition vocabulary

| verb | meaning | what lands in the corpus |
|---|---|---|
| NEW `<id>` | mechanism no existing case owns | a new `cases/<category>/<id>.md` |
| REF `<id>` | additional evidence for an existing case | a commit URL appended to that case's `refs:` |
| REJECT `<reason>` | no generalizable Windows mechanism | a ledger row only |

REJECT reasons are a closed set so the ledger stays scannable: `test-only`,
`refactor`, `repo-specific`, `no-windows-mechanism`, `docs-only`,
`security-unrelated`, `already-covered-elsewhere`.

### Prior REJECTs are not binding

A prior round's REJECT was made under that round's scope, and the project's scope
has since widened from PowerShell proper to the whole Windows interop minefield.
A mechanism rejected earlier as "not PS/shell-spawn" can be legitimate now.
Overturns are allowed and must be VISIBLE: the ledger row reads
"NEW <id> (overturns <prior-sha> REJECT: <prior reason>)" and the decade doc says
why the earlier reason no longer applies. Silently recreating a rejected mechanism
is the failure mode this rule exists to prevent.

## Generalizability bar

A case earns its place only if a stranger who never used these repos can hit the
same wall. The test is whether the Repro section can be written using nothing but
stock Windows, PowerShell, and a mainstream runtime. If the repro needs this
project's own code to reproduce, it is REJECT `repo-specific` no matter how
painful the bug was.

## Analyst lane protocol

One `xai/grok-4.6` explorer per repo, all five dispatched in parallel. Each lane is
read-only, receives its frozen inventory path plus its decade doc, and must return
`Coverage: N/N` plus one disposition line per SHA.

Parallel research does NOT make the work-phases parallel. The five PABCD cycles
still run one at a time in order, because each cycle writes cases the next cycle
must dedupe against. Where two lanes nominate the same mechanism — ima2-gen and
agbrowse both plausibly hit file locking — the earlier work-phase writes the case
and the later one appends a ref. That merge-dedupe step is the main agent's job at
the start of each Build phase, and it is the reason lanes may run together while
cycles may not.

The main agent is the decision boundary: the analyst proposes, the main agent
re-reads the cited diff before any NEW case is written. An analyst proposal with
no verbatim anchor is rejected on the spot; a proposal whose anchor does not say
what the analyst claims is downgraded to REJECT and noted in the judgment-calls
section of that repo's decade doc.

## Coverage gate

Per repo, `bun scripts/check-coverage.mjs <repo>` compares the FULL SHAs in
`inv/win_<repo>.txt` against the SHA prefixes appearing in that repo's decade-doc
disposition table, and exits non-zero listing any SHA with no row. It is a script,
not a remembered one-liner, so the evidence is reproducible. It runs during the
Check phase of that work-phase and its output is the criterion evidence. A missing
SHA fails the work-phase regardless of how many cases were written.

## Case file contract

Two different gates enforce two different halves of this, and conflating them is
how a case passes lint and then fails the graph.

### Enforced by scripts/lint-cases.mjs

- `id` equals the filename stem; the folder name equals `category`; a case may not
  sit in `cases/` root.
- `category` is one of: aliases, args-quoting, streams, encoding, exit-codes,
  versions, env-paths, ci-agents, collections, parsing.
- `versions` is a QUOTED string, one of "5.1", "7.x", "both". An unquoted numeric
  is rejected outright (the YAML float trap).
- `failure` is silent, hard-error, or misleading-error. `context` is a non-empty
  subset of interactive, script, ci, agent. `source` is first-party or third-party.
  `repro` is verified or historical.
- `refs` has at least one public URL; a third-party case additionally requires a
  github commit or PR URL.
- the four headings Symptom, Repro, Cause, Workaround are all present. Lint checks
  presence only, not order — write them in that order anyway.

Lint does NOT look at the `ontology:` block at all.

### Enforced by scripts/validate-graph.mjs, after build-graph

- V6: a case whose `failure` is not `silent` must have `manifests_as`. A
  hard-error case without it passes lint and fails here.
- V7: every case must have `caused_by`.
- V8: a new concept file needs a `## Definition` section of at most 400 characters.
- V9: any concept referenced as `unsafe_fix` needs a `## Why it's unsafe` section.
- V11: the graph's case stems must match what is on disk, which is why build-graph
  must run first.

`affects` and `invokes` are conventional, not required — `node-path-host-delimiter`
ships with neither. New concepts are added by writing `ontology/concepts/<id>.md`
directly; `gen-concepts.mjs` is a one-shot seeded from `concept-defs.json` and is
not the live path.

### Enforced by the site build

A backslash in the YAML `title` breaks the converter and the build — a prior round
shipped a mangled title and had to repair it. Keep titles backslash-free.
