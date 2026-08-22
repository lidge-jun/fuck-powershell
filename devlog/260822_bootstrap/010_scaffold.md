# 010 — Repo scaffold (wp2 first half)

## Tree

\`\`\`
fuck-powershell/
├── README.md              # hook name, serious description, install one-liner, site link
├── LICENSE                # MIT
├── .gitignore             # node_modules, dist, .astro
├── cases/                 # one md per case, flat (category lives in frontmatter)
├── scripts/lint-cases.mjs # bun script: parse frontmatter, validate enums + body sections
├── skills/powershell-landmines/   # 030
├── docs-site/             # 040
└── .github/workflows/deploy.yml   # 040
\`\`\`

## lint-cases.mjs contract

- Parse YAML frontmatter of every cases/*.md (no dependency: hand-rolled key: value
  parser is enough for our flat schema; arrays via [a, b] inline form).
- Validate: id matches filename, category in 8-enum, versions in {5.1,7.x,both},
  failure in {silent,hard-error,misleading-error}, context subset of 4-enum,
  body contains "## Symptom", "## Repro", "## Cause", "## Workaround".
- Third-party cases (refs non-empty with github.com commit/pull URL) required for id
  prefixed \`oss-\`.
- Exit 1 with per-file errors; exit 0 prints "N cases OK".
