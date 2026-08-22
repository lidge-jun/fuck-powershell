---
title: Case schema
description: The YAML frontmatter schema every case must pass.
---

One markdown file per case at `cases/<category>/<id>.md`, validated by
`bun scripts/lint-cases.mjs` (folder must match the frontmatter category).

```yaml
id: curl-alias                 # equals filename stem, unique
title: curl silently becomes Invoke-WebRequest
category: aliases              # 10 buckets incl collections, parsing
versions: "5.1"                # "5.1"|"7.x"|"both" — quoted (5.1 is a YAML float trap)
failure: misleading-error      # silent|hard-error|misleading-error
context: [agent, ci]           # subset of interactive|script|ci|agent
source: first-party            # first-party|third-party
repro: verified                # verified|historical
refs:                          # public URLs; third-party requires commit/PR
  - https://github.com/...
```

Body must contain `## Symptom`, `## Repro`, `## Cause`, `## Workaround`.

Yes, the schema's own `versions` field is a PowerShell-grade landmine: unquoted
`5.1` parses as a float in YAML. The linter rejects it. We eat our own cooking.
