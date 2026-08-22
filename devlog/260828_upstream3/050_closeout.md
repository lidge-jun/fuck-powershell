# 050 — Upstream round closeout

845 rows dispositioned across three repositories the project does not own. Ten
new cases, 76 to 86. Ontology 271 nodes / 563 edges to 300 / 613.

| repo | commits | issues | NEW | REF | REJECT |
|---|---|---|---|---|---|
| openai/codex | 44 | 176 | 6 | 68 | 146 |
| NousResearch/hermes-agent | 129 | 159 | 2 | 96 | 190 |
| openclaw/openclaw | 232 | 105 | 2 | 34 | 301 |

## Admitting open issues changed what was findable

Four of the ten new cases came from bug reports nobody has fixed, and two of
those are among the strongest in the corpus. `cmd-lf-drops-first-byte` and
`kill-hits-one-pid-or-the-whole-tree` exist only because open issues counted this
round; neither has a merged commit anywhere in the 405 mined.

That is not an accident of sampling. A merged fix means someone understood the
mechanism well enough to close it, which biases commit mining toward problems
that were tractable. An unresolved report with a clean reproduction is evidence of
a wall that is still standing — which, for a lookup surface aimed at agents about
to write Windows-touching code, is the more useful half.

The rule that made it safe: judge the REPORT, not the maintainers' response. A
`wontfix` says something about a project's priorities and nothing about whether
the mechanism is real.

## The language spread paid off exactly where predicted

020 predicted that Python would be the richest vein because the corpus told only
the Node half of several stories. Both hermes cases confirm it:
`python-textio-newline-translation` (text mode translates on WRITE, so a pipe
injects CRs) and `python-subprocess-locale-encoding` (`text=True` decodes with the
ANSI codepage under strict errors) are CPython behaviors that no PowerShell or
Node case implies.

It also predicted the failure mode, and that showed up too: the lane proposed 21
candidates, and most became REFs because they were Python-flavored restatements
of mechanisms the corpus already owns. A UTF-8 BOM read as data is the same
sentence whether the reader is `grep` or `json.loads`. "Different language" is
never by itself a reason for a new case, and this round was the first real test of
that rule.

## What the openclaw tail teaches about grep tiers

232 openclaw commits, of which 188 were a single `truncateUtf16Safe` sweep
matched by the `utf-16` term. UTF-16 code units are an API contract on every
platform; none of it is a Windows trap.

The Tier-1 grep was supposed to require a named Windows MECHANISM rather than the
word "windows", and `utf-16` slipped through as a term that names a mechanism in
the corpus's own vocabulary but not in a TypeScript string-length context. Worth
recording for the next round: a term earns its place in the tier only if a match
on it is usually Windows-shaped, and `utf-16` failed that on this codebase while
passing on every earlier one.

## New gates

`scripts/check-upstream-coverage.mjs` gates commits and issues SEPARATELY. A
single combined count would let a complete commit table hide an empty issue table,
which is precisely the shape this round's method could have failed into.

`lint-cases.mjs` now accepts an issue URL as third-party evidence, alongside
commits and vendor documentation. The rule lists all three explicitly with the
reasoning, because the previous round showed what happens when the rule is too
narrow: two documentation-sourced cases were given an unrelated chore commit to
satisfy it, which is worse evidence than the spec they actually rested on.

## Provenance is now three-way

A reader should be able to tell where a case came from, because the three sources
have different staleness risks:

- **first-party mined** (five repos, 522 rows): the mechanism was hit and fixed by
  code this project controls, so the anchor stays reachable.
- **upstream mined** (this round, 845 rows): the anchor is someone else's commit
  or issue and may be closed, edited, or force-pushed out from under the case.
- **documentation** (reserved device names, MAX_PATH): no commit anywhere
  demonstrates it; the vendor spec is the evidence, and a spec can change.

Every case carries `source:` and its refs, so this is already inspectable — but
it is worth stating that upstream refs are the ones most likely to rot.

## Held for a later round

Real, uncovered, and currently resting on a single issue or a mocked test each:

- `msys-arg-path-conversion` / `msys-posix-drive-path` — Git Bash rewriting
  `/FO` into a path, and `/c/Users` reaching a native binary unconverted. These
  two need one case covering both directions of `MSYS_NO_PATHCONV`, not two
  half-cases.
- `win32-stat-zero-inode` — libuv reporting `ino=0` under antivirus contention,
  so identity-by-inode is undefined.
- `hidden-console-still-istty` — a hidden console still reports `isTTY`, so
  TTY-gated prompts block on a window nobody can see.
- `schtasks-ignore-new-drops-run` — `IgnoreNew` silently rejecting `/Run` during
  the previous instance's shutdown.
- `node-symlink-defaults-file` — `fs.symlink` defaulting to a file link, needing
  `junction` or elevation for directories.
- `colon-illegal-in-filename`, `junction-resolve-diverges`,
  `non-pe-exe-16bit-dialog`, `programfiles-shim-eperm`.
