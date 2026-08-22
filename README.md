# fuck-powershell

A reproducible-case archive of PowerShell landmines: the places where POSIX
assumptions, innocent-looking aliases, and Windows PowerShell 5.1 legacy behavior
quietly (or loudly) destroy cross-platform scripts, CI pipelines, and coding agents.

The name is the mood. The content is serious: every case is a real failure with a
**Symptom / Repro / Cause / Workaround** writeup and a citation to a real public
commit, PR, or source file — first-party incidents and mined open-source fixes alike.

## Why

Cross-platform CLIs and AI coding agents keep stepping on the same mines:
`curl` that is secretly `Invoke-WebRequest`, `> /dev/null` that kills a Windows CI
job, BOM-less `.ps1` files parsed as the ANSI code page, native exit codes silently
ignored. The classic gotcha collections predate PowerShell 7 and the agent era.
This archive documents the traps as machine-readable cases so both humans and
agents can avoid them.

## Browse

- **Cases**: [cases/](cases/) — one markdown file per landmine, organized as
  `cases/<category>/<id>.md`, YAML frontmatter (category, affected versions,
  failure mode, context).
- **Docs site**: https://lidge-jun.github.io/fuck-powershell/ (live render)

## Install the agent skill

A distilled skill (`powershell-landmines`) ships in this repo for Codex/Claude-style
agents. With the skill-installer skill available:

```
scripts/install-skill-from-github.py --repo lidge-jun/fuck-powershell --path skills/powershell-landmines
```

Or just copy `skills/powershell-landmines/` into your agent's skills directory.

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
