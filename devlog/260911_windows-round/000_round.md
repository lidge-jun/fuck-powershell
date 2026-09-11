# 260911 — Windows round: 4 cases, and the linter that never worked on Windows

Source of the material: a day spent porting a macOS-only browser-automation skill to
Windows. Everything below was measured on that machine (Windows 11 build 26200,
Git 2.55.0.windows.3, pwsh 7.6.6) while doing unrelated work, which is the intended
way for this corpus to grow.

## Cases added

| id | category | issue | why it is a landmine |
|---|---|---|---|
| `junction-empty-print-name` | env-paths | #54 | a vendor junction on PATH lists as an empty folder; no probe errors |
| `timeout-is-not-a-command-wrapper` | aliases | #55 | System32 `timeout` sleeps and reports success; Git's GNU one shadows it |
| `perl-alarm-raw-wait-status` | exit-codes | #56 | the deadline fires, the exit code is 3584 instead of 142 |
| `git-merge-driver-sh-escapes` | args-quoting | #57 | driver never runs; git reports an ordinary merge conflict |

`repro-merge-driver.ps1` is the three-way repro for #57 — backslash path, forward-slash
path, explicit interpreter — and is the strongest artifact in this round because all
three failures are indistinguishable from a real conflict at the exit-code level.

New ontology nodes: `mechanism-empty-print-name`, `mechanism-sh-escape-processing`,
`workaround-native-process-deadline`, `workaround-resolve-versioned-target`.

## Two bugs in our own tooling, both on-topic

`bun scripts/lint-cases.mjs` reported **all 98 cases** as `missing frontmatter` on
this machine. Two separate Windows assumptions, stacked:

1. `parseFrontmatter` in `lint-cases.mjs` anchored on `/^---\n/`. The shared parser
   in `scripts/lib/frontmatter.mjs` was already made CRLF-tolerant in the B3 audit,
   but the linter kept its own copy and never got the fix. A Windows checkout with
   `core.autocrlf=true` has a CRLF worktree, so nothing matched.
2. After that, every case failed with `must live in cases/<category>/`, because
   `readdirSync({recursive:true})` returns the host separator — `parsing\x.md` — and
   the check looked for `/`.

Both produce a *vacuous global failure*: the output says the corpus is corrupt, when
the corpus is fine and the reader is wrong. That is `error-vacuous-pass` inverted,
and it is the exact failure class this project exists to document. A repo about
Windows landmines could not lint itself on Windows.

Added `.gitattributes` with `* text=auto eol=lf` so the worktree stops being CRLF in
the first place. The index was already LF, so no renormalize was needed — but a fresh
clone before this commit had the broken linter.

## Install path changed

The skill now installs by **copy**, never symlink, via `scripts/install-skill.mjs`.
`--check` reports drift, which is the part that was missing: a copied skill is a build
artifact and silently goes stale after every corpus change.

`README.md` previously pointed at `scripts/install-skill-from-github.py`, which does
not exist in this repo.

The documented checkout location moved from `~/.fuck-powershell` to a real working
directory. Agents now resolve `$FP_HOME` → `~/Developers/fuck-powershell` →
`~/.fuck-powershell` rather than hardcoding one path, because the corpus is a repo you
contribute to, not a cache.

`.github/ISSUE_TEMPLATE/landmine.yml` makes the report shape match the case schema, so
conversion is mechanical and the "search for near-miss cases first" step is explicit.

## Follow-ups

- `README.md` still says 87 cases / 303 nodes / 618 edges. Actual: 98 / 343 / 717.
- Not filed as a case: `hostname -s` is rejected by MSYS `hostname` (`unknown option`),
  which aborts a `set -e` installer. One data point, no second sighting yet.
- Not filed: the Store `python3` stub returning a friendly sentence on stdout with a
  non-zero code. It appears as variant B inside #57 and overlaps
  `windowsapps-alias-eperm`; worth its own case if it shows up standalone again.

