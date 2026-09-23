# fuck-powershell

**A local failure-intelligence engine for coding agents on Windows.**

112 reproducible cases of Windows shell & process landmines — alias traps, spawn
semantics, PATH/PATHEXT resolution, encodings, exit codes, cmd.exe re-parsing,
mandatory file locking, CRLF residue, localized tool output, process-tree
termination, PowerShell 5.1 legacy behavior — bound into a typed ontology
(396 nodes, 826 edges) that an agent can QUERY BEFORE PATCHING instead of
debugging after the explosion. PowerShell is the brand; the corpus is the whole
Windows interop minefield.

The name is the mood. The content is serious: every case is a real failure with
a **Symptom / Repro / Cause / Workaround** writeup and a citation to a real
public commit, PR, or source file — first-party incidents and mined open-source
fixes alike. Every case carries typed edges (mechanism, error signature,
safe/unsafe workarounds) validated in CI on every deploy.

```
$ bun scripts/fp.mjs preflight --runtime node --operation spawn --target npm
risk: high
   8  spawn-npm-enoent-einval    [invokes:command-npm, caused_by:mechanism-pathext-resolution, ...]
   8  get-command-where-disagree [invokes:command-npm, caused_by:mechanism-cmd-reparse, ...]
   6  path-dot-hijacks-bare-npm  [invokes:command-npm, ...]
constraints:
  - comspec dispatch
  - get command
```

## How it fits together

| layer | what it is | where |
|---|---|---|
| Cases | 112 markdown files, canonical source of truth | [cases/](cases/) |
| Ontology | typed graph generated from case frontmatter, V1-V11 validated | [ontology/](ontology/) + `scripts/build-graph.mjs` |
| fp engine | graph-walking lookup CLI: preflight / search / errors / case | `scripts/fp.mjs` |
| MCP server | the same four lookups as read-only MCP tools, zero dependencies, updates itself from git | `scripts/mcp.mjs` |
| Agent skill | query-first retrieval policy + fallback rules | [skills/powershell-landmines/](skills/powershell-landmines/) |
| Docs site | Apple-clean live render with At-a-glance cards + symptom reverse index | [live site](https://lidge-jun.github.io/fuck-powershell/) |

## Why

Cross-platform CLIs and AI coding agents keep stepping on the same mines:
`curl` that is secretly `Invoke-WebRequest`, `> /dev/null` that kills a Windows CI
job, BOM-less `.ps1` files parsed as the ANSI code page, native exit codes silently
ignored. The classic gotcha collections predate PowerShell 7 and the agent era.
This project documents the traps as machine-readable, graph-linked cases so an
agent can turn "about to spawn npm on Windows" into "read these 3 cases first"
— before writing code, not after the error.

## Query before you patch (fp)

```
git clone https://github.com/lidge-jun/fuck-powershell ~/Developers/fuck-powershell
export FP_HOME=~/Developers/fuck-powershell
bun $FP_HOME/scripts/fp.mjs preflight --runtime node --operation spawn --target npm
bun $FP_HOME/scripts/fp.mjs errors einval
bun $FP_HOME/scripts/fp.mjs search "iex exit terminal"
bun $FP_HOME/scripts/fp.mjs case spawn-npm-enoent-einval
```

Keep it as a working checkout, not a hidden cache — you will be adding to it.
Agents resolve `$FP_HOME` -> `~/Developers/fuck-powershell` -> `~/.fuck-powershell`.

Operations: `spawn · env-path · encoding · redirect · exit-code · quoting ·
install · ci`. `preflight` walks the graph and returns ranked cases +
constraints (`--json` for machine use — wire it into your agent's pre-patch
hook). `errors` is the symptom-first reverse index: saw EINVAL? Get the cases.

## Use it as an MCP server

`scripts/mcp.mjs` serves the same lookups over MCP's stdio transport. It has no
dependencies and runs on Node 18+ or Bun. It speaks the current stateless MCP revision
(2026-07-28, including `server/discover`) and still answers hosts that open with
`initialize` (2025-11-25 back to 2024-11-05).

Give the server its own clone, so the checkout you work in is never pulled under you:

```
git clone https://github.com/lidge-jun/fuck-powershell ~/.fuck-powershell
codex mcp add fuck-powershell --env FP_AUTO_UPDATE=1 -- node /absolute/path/to/.fuck-powershell/scripts/mcp.mjs
claude mcp add fuck-powershell -e FP_AUTO_UPDATE=1 -- node /absolute/path/to/.fuck-powershell/scripts/mcp.mjs
```

| tool | use it for |
|---|---|
| `fp_preflight` | before writing code: runtime / operation / target / shell -> ranked cases + constraints |
| `fp_search` | free-text tokens from a diff or an error message |
| `fp_errors` | an error signature (`einval`, `enoent`, `eperm`...) -> the cases that manifest it |
| `fp_case` | one case: Symptom, Cause and Workaround by default; `full: true` adds Repro |

Every answer starts with `corpus <sha> · <n> cases`, so you can tell which version of
the corpus answered.

How updates reach the server:

- The server reads the cases from its clone on every call and rebuilds its index when a
  case file changes. A `git pull` in that clone is enough: no reinstall, no restart.
- With `FP_AUTO_UPDATE=1` the server does that pull itself: `git fetch` plus a
  fast-forward at most every 6 hours, in the background, and only when the clone is
  clean, on a branch with an upstream, and not diverged. Anything else is skipped and
  shown in the answer header (`update: skipped:dirty`), never forced.
- A change to the server script itself takes effect the next time the host starts the
  server, which is normally the next session.

Environment: `FP_HOME` (corpus root, defaults to the script's own checkout),
`FP_AUTO_UPDATE=1`, `FP_UPDATE_INTERVAL_MS` (default 6 h), `FP_STATE_DIR` (where the
last update attempt is recorded).

## Install the agent skill

The `powershell-landmines` skill makes lookup the default behavior: preflight
before Windows-shell-risk patches, postflight over the diff, compact fallback
rules when the corpus is not installed.

```
bun scripts/install-skill.mjs                 # -> $CODEX_HOME/skills, else ~/.codex/skills
bun scripts/install-skill.mjs --target DIR    # any other agent's skills directory
bun scripts/install-skill.mjs --check         # CI/pre-commit: has the copy drifted?
```

The install is a **copy, not a symlink**. A symlink breaks when the checkout moves
and needs Developer Mode or elevation to create on Windows in the first place.
The tradeoff is that the copy is a build artifact: it does not track the repo, so
rerun the install after any corpus change. `--check` is what tells you it is stale.

## Browse

- **Cases**: [cases/](cases/) — one markdown file per landmine, organized as
  `cases/<category>/<id>.md`, YAML frontmatter (category, affected versions,
  failure mode, context, ontology edges). 10 categories, from `aliases` to
  `parsing`.
- **Docs site**: [lidge-jun.github.io/fuck-powershell](https://lidge-jun.github.io/fuck-powershell/)
  — [All cases](https://lidge-jun.github.io/fuck-powershell/cases/) by category,
  [Mechanisms](https://lidge-jun.github.io/fuck-powershell/ontology/mechanisms/)
  (shared root causes), and
  [Error signatures](https://lidge-jun.github.io/fuck-powershell/ontology/errors/)
  (symptom → case reverse index).
- **Ontology locally**: `bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs`
  (also runs inside every docs build, so CI rejects an inconsistent graph).

## Case schema

```yaml
id: curl-alias                 # must equal filename stem, unique; file lives in cases/<category>/
title: curl silently becomes Invoke-WebRequest
category: aliases              # aliases|args-quoting|streams|encoding|exit-codes|versions|env-paths|ci-agents|collections|parsing (must match folder)
versions: "5.1"                # "5.1"|"7.x"|"both" (quoted — 5.1 is a YAML float trap)
failure: misleading-error      # silent|hard-error|misleading-error
context: [agent, ci]           # subset of interactive|script|ci|agent
source: first-party            # first-party|third-party
repro: verified                # verified|historical
refs:                          # public URLs; third-party cases must cite commit/PR
  - https://github.com/...
```

Body sections: `## Symptom`, `## Repro`, `## Cause`, `## Workaround`.
Validate with `bun scripts/lint-cases.mjs`.

## Contributing

The loop is issue-first, and it is meant to be continuous — every real Windows
failure you survive is corpus material while the evidence is still on your screen.

1. **Search before filing.** `bun scripts/fp.mjs search "<keywords>"`. If a case
   already covers it, say so in your issue and explain the distinction, or skip.
2. **File the issue** with `.github/ISSUE_TEMPLATE/landmine.yml` — Symptom /
   Repro / Cause / Workaround, plus a control run that works. One landmine per issue.
   `gh issue create --repo lidge-jun/fuck-powershell --template landmine.yml`
3. **Convert to a case** under `cases/<category>/<id>.md`, citing the issue URL in
   `refs`. Then `bun scripts/lint-cases.mjs` and `bun scripts/build-graph.mjs &&
   bun scripts/validate-graph.mjs`.
4. **Regenerate and reinstall**: `bun scripts/build-skill.mjs` then
   `bun scripts/install-skill.mjs`. Close the issue referencing the case.

One case per file, schema-linted, with a reachable public citation. First-party
incidents may cite your own commit. War stories without evidence stay open as
issues until a reproduction exists — they are not deleted, they are just not cases.

## License

MIT
