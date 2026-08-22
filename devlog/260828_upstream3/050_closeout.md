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

## The audit found a gate that was lying

The A gate on this round returned FAIL, and the most valuable finding was not
about a case. `check-upstream-coverage.mjs` matched hex tokens anywhere in a
decade doc, so it never checked that a row carried a disposition verb or that a
`NEW` named a case that exists. It reported OK for all three repos while the
tables claimed `NEW` for eight ids nobody wrote and `REF` for files that are not
on disk.

Rewritten to parse rows, it found 64 ghost entries immediately. Two bugs in the
fix itself surfaced in the same pass: hyphenated ids were truncated at the first
uppercase letter (`env-path-vs-PATH-casing` became `env-path-vs`), and an
all-digit abbreviated SHA was classified as an issue number. Both now
disambiguate explicitly — the second on the `#` marker rather than on the
character class.

That is the lesson worth keeping: a coverage gate that counts identifiers is not
a coverage gate. It has to read the judgment, and it has to check that the
judgment refers to something real. A gate reporting OK while the ledger disagrees
with the corpus is worse than no gate, because it converts an inconsistency into
a certificate.

`HELD` exists now as a fourth verb for the same reason. A mechanism that is real,
uncovered, and deliberately not written yet needs an honest place to sit; leaving
it marked `NEW` is a ledger that lies about what shipped.

## Three cases were factually wrong

`cmd-lf-drops-first-byte` claimed LF makes cmd.exe eat the first byte of every
line during sequential execution. It does not — straight-line scripts mostly
survive LF, which is exactly why "it worked when I tried it" is such a common
and misleading data point. The real mechanism is the label scanner: cmd.exe
re-seeks on `goto` and `call`, and its chunked reader assumes a two-byte
terminator, so a label near a chunk boundary is read at the wrong offset.
`npm.cmd` uses `goto`, which is why the reported symptoms name npm. The repro was
rebuilt around that, and a verification note now records that the originating
issue was itself an unexecuted report — the case had been inheriting its Cause
from a theory.

`path-unmatched-quote-swallows` presented a Node `ENOENT` result that does not
happen. libuv treats an entry as quoted only when it STARTS with a quote, so Node
walks past a mid-entry stray that Rust's `split_paths` chokes on. The case is
about Rust, and the three-parser disagreement is now the point: a diagnostic run
through a different runtime than the failing program confirms the wrong thing.

`python-subprocess-locale-encoding` said "console codepage" where its own Cause
said ANSI — different values on Western Windows — and its repro used `echo` with
Korean text on a cp949 box, which decodes cleanly. The trap needs a MISMATCH
between what the child emits and what the parent's locale says, not merely
non-ASCII text.

One REF was also wrong. `684a9b2e` had been folded into
`wsl-unc-rejects-nt-acl` on a "same provider boundary" gloss; cmd.exe refusing a
UNC working directory applies to every UNC path including network shares and has
nothing to do with security descriptors. It is now
`cmd-unc-cwd-not-supported`, the eleventh case of the round.

## Evidence bar tightened

`lint-cases.mjs` now requires a second primary source — vendor documentation,
runtime source, or a captured transcript — or an explicit
`## Verification note` when an OPEN ISSUE is the only evidence. Admitting issues
was right; admitting an issue's THEORY as a case's Cause was not, and
`cmd-lf-drops-first-byte` was that failure. Three cases citing nothing but an
issue were caught by the new rule the moment it landed.

## Held for a later round

Real, uncovered, and currently resting on a single issue or a mocked test each.
The first three are here because the A-gate reviewer judged my REFs too strict
and I agree on re-reading — a Python codec trap is not the same reader situation
as a PowerShell writer default:

- `python-utf8-bom-not-sig` — `open(..., encoding="utf-8")` keeps a BOM as
  U+FEFF data; `utf-8-sig` strips it. Knowing Out-File writes a BOM does not warn
  a Python reader about the codec split.
- `python-open-utf16le` — a Notepad or PowerShell-redirect UTF-16LE file read
  with `encoding="utf-8"`.
- `console-oem-bytes-as-utf8` — a Node parent decoding a console child's OEM
  bytes as UTF-8. I accepted the Python parent-decode case and folded the Node one
  into the PowerShell CHILD-encode case, which is inconsistent.

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
