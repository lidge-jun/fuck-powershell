# fuck-powershell

**A local failure-intelligence engine for coding agents on Windows.**

70 reproducible cases of Windows shell & process landmines — alias traps, spawn
semantics, PATH/PATHEXT resolution, encodings, exit codes, cmd.exe re-parsing,
mandatory file locking, CRLF residue, localized tool output, PowerShell 5.1
legacy behavior — bound into a typed ontology (251 nodes, 526 edges) that an
agent can QUERY BEFORE PATCHING instead of debugging after the explosion.
PowerShell is the brand; the corpus is the whole Windows interop minefield.

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
| Cases | 70 markdown files, canonical source of truth | [cases/](cases/) |
| Ontology | typed graph generated from case frontmatter, V1-V11 validated | [ontology/](ontology/) + `scripts/build-graph.mjs` |
| fp engine | graph-walking lookup CLI: preflight / search / errors / case | `scripts/fp.mjs` |
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
git clone https://github.com/lidge-jun/fuck-powershell ~/.fuck-powershell
bun ~/.fuck-powershell/scripts/fp.mjs preflight --runtime node --operation spawn --target npm
bun ~/.fuck-powershell/scripts/fp.mjs errors einval
bun ~/.fuck-powershell/scripts/fp.mjs search "iex exit terminal"
bun ~/.fuck-powershell/scripts/fp.mjs case spawn-npm-enoent-einval
```

Operations: `spawn · env-path · encoding · redirect · exit-code · quoting ·
install · ci`. `preflight` walks the graph and returns ranked cases +
constraints (`--json` for machine use — wire it into your agent's pre-patch
hook). `errors` is the symptom-first reverse index: saw EINVAL? Get the cases.

## Install the agent skill

The `powershell-landmines` skill makes lookup the default behavior: preflight
before Windows-shell-risk patches, postflight over the diff, compact fallback
rules when the corpus is not installed.

```
scripts/install-skill-from-github.py --repo lidge-jun/fuck-powershell --path skills/powershell-landmines
```

Or copy `skills/powershell-landmines/` into your agent's skills directory.

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

PRs welcome. One case per file, schema-linted, with a reachable public citation.
War stories without evidence go in Discussions until a commit URL exists.

## License

MIT
