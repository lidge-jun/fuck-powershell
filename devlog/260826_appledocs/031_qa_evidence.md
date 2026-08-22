# 031 — Browser QA evidence (aw4)

Surface: Codex In-app Browser (browser plugin, iab binding), site served from
built dist at localhost:4335 under /fuck-powershell/ base.

| stop | action | result | console |
|---|---|---|---|
| 1 | goto hero / | title renders, URL ok | 0 errors |
| 2 | click pill-nav "Cases" | → /cases/ index | 0 |
| 3 | click first card row | → /cases/aliases/command-v-noop/ | 0 |
| 4 | click mech chip | → /ontology/mechanisms/#absent-builtin-noop | 0 |
| 5 | errors page → first case link | → /cases/env-paths/env-domain-principal/ | 0 |
| 6 | light theme screenshot (playwright --color-scheme=light) | qa-case-light.png inspected: card/badges legible on #f5f5f7 | n/a |

Zero console entries across all stops. No dead links on tested paths. One
limitation noted: iab playwright.evaluate is read-only (theme flip done via
color-scheme screenshot instead of DOM mutation).

Defects found this cycle: cc-grid stretch (fixed in aw3 before QA).
