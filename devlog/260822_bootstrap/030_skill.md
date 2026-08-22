# 030 — Skill spec (wp3 first half)

skills/powershell-landmines/
├── SKILL.md         # frontmatter name/description with EN+KR triggers; routing table
│                    # category → references file; hard rules (never bare curl, never
│                    # > /dev/null, always $LASTEXITCODE, always -Encoding utf8)
└── references/      # generated: one md per category concatenating that category's cases

SKILL.md stays ≤150 lines: 10-rule "before you run pwsh" checklist + routing.
Generation: scripts/build-skill.mjs concatenates cases by category into references/
(run manually for v0; CI later). Install one-liner in README:
skill-installer --repo lidge-jun/fuck-powershell --path skills/powershell-landmines
