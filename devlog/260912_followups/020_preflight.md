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

---

## Result (wp2 B/C evidence)

The change is confined to how `--target` contributes, in two parts:

1. If the target names a `Runtime` or `Shell` node (`runtime-python`, `shell-cmd`),
   that node joins `queryNodes` so `affects` edges count normally.
2. In the no-Command-node branch, an **id token** match scores 3 (the corpus's own
   statement that the case is about the target, weighted like an `invokes` hit) and a
   **title-only** mention scores 1. Tokens are compared whole with a trailing-digit
   tolerance, so `python` matches the `python3` token but `pip` does not match
   `piped-iex-drops-params`.

The audit forced two corrections: an id weight of 4 was capped to 3, because 4 beats
`invokes` and would push text matches past the `score >= 5` risk threshold; and an
unanchored `includes()` was replaced with token matching. It also proposed plain token
equality, which would have **missed the target case**, since
`windowsapps-python3-stub-needs-probe` tokenises to `python3`.

### The query this phase exists for

```
fp preflight --runtime node --operation spawn --target python

BEFORE                                         AFTER
5  get-command-where-disagree                  5  get-command-where-disagree
5  spawn-npm-enoent-einval                     5  spawn-npm-enoent-einval
3  npm-ps1-not-comspec                         4  python-subprocess-locale-encoding
3  cmd-shim-reparses-argv                      4  python-textio-newline-translation
3  shell-true-fallback-injects                 4  windowsapps-python3-stub-needs-probe
3  path-dot-hijacks-bare-npm                   3  npm-ps1-not-comspec
```

The target case is present. Two other genuinely python-specific Windows cases came with
it, which is accepted rather than suppressed: they belong in the answer to "about to run
python on Windows". The npm/PATHEXT pair still leads, which is correct for `spawn`.

### The second defect, which the phase found rather than planned

```
fp preflight --operation env-path --target bash

BEFORE                                         AFTER
2  bash-on-path-may-be-wsl     [text:bash]     3  bash-on-path-may-be-wsl  [id:bash]
2  msys-rewrites-slash-args    [text:bash]     2  env-path-vs-PATH-casing
2  actions-default-shell       [text:bash]     2  envpath-pollutes-user
2  npm-script-runs-under-cmd   [text:bash]     2  node-path-host-delimiter
2  autocrlf-shebang-cr         [text:bash]     2  path-colon-not-delimiter
2  caller-picks-interpreter... [text:bash]     2  session-path-stale
```

Before, the case that IS about bash tied with five that merely mention it, and
`actions-default-shell` — a case about GitHub Actions defaulting to PowerShell — was
presented as equally relevant. After, the right case leads alone.

### Controls

| query | result |
|---|---|
| `--operation spawn --target npm` | identical |
| `--runtime node --operation spawn` | identical |
| `--operation encoding` | identical |
| `--operation exit-code` | identical |
| `--operation ci` | identical |
| `--runtime node --operation spawn --target node` | identical |
| `--operation quoting --target git` | identical |
| `--operation spawn --target where` | identical |
| `--operation spawn --target pip` | identical |
| `--operation spawn --target sh` | improved — a spurious `text:sh` mention drops from 4 to 3 |
| `--operation encoding --target python` | improved — the two python encoding cases surface |

### One change I predicted would not happen

I told the auditor that every target with a `Command` node would be untouched. That is
**not true**, and the evidence says so: `--operation quoting --target cmd` changed,
because part 1 above is deliberately outside the no-Command-node guard and `shell-cmd`
now joins the query.

```
BEFORE                                    AFTER
5  cmd-c-newline-not-separator            6  cmd-c-newline-not-separator
4  prose-as-unknown-flags                 4  cmd-shim-reparses-argv
3  cmd-shim-reparses-argv                 4  cmd-star-ignores-shift
3  cmd-star-ignores-shift                 4  cmd-start-ampersand-splits
3  cmd-start-ampersand-splits             4  msys-rewrites-slash-args
3  msys-rewrites-slash-args               4  prose-as-unknown-flags
```

Nothing was lost — `prose-as-unknown-flags` is still returned — and the cases that are
specifically about cmd.exe moved above the generic quoting case. That is the behaviour
a `--target cmd` query should have. Keeping it, and recording that my stated invariant
was wrong, is better than suppressing a correct result to protect a claim I made before
measuring. `queryNodes` is a `Set`, so a target that repeats the runtime (`--runtime
node --target node`) cannot double-count, which the identical control above confirms.

