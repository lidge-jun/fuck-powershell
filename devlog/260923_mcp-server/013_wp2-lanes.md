# 013 — wp2 execution plan (lanes)

wp1 D direction carried forward: "wp2 P re-verifies 010–012 against the tree, then a sol
implementer builds them." Unchanged, with the build split across two sol implementer
subagents so the server and the core are written in parallel against the interface
fixed in 010.

## Stale check (2026-09-23, HEAD 76bb7ac)

`git diff --stat b59324b HEAD -- scripts tests .github README.md skills` is empty:
the only commits since the audited base are this unit's docs. Line anchors in 010/011
(fp.mjs 20–31, 105–109; build-graph 10, 12–48; frontmatter 24–27) still hold.

## Lanes (subagents in this checkout; disjoint write scopes; no git writes by lanes)

| Lane | Model | Writes (only these) | Reads |
|---|---|---|---|
| L1 core | gpt-6-sol | `scripts/lib/fp-core.mjs`, `scripts/fp.mjs`, `scripts/build-graph.mjs`, `tests/core.test.mjs`, `tests/cli.test.mjs` | 010, 012 core/cli sections, current scripts |
| L2 server | gpt-6-sol | `scripts/mcp.mjs`, `scripts/lib/auto-update.mjs`, `tests/helpers.mjs`, `tests/mcp.test.mjs`, `tests/auto-update.test.mjs` | 001, 011, 012 mcp/auto-update sections, 010 interface |
| main | — | `.github/workflows/ci.yml`, `README.md`, `skills/powershell-landmines/SKILL.md`, this unit, all commits | everything |

The parity verifier `evidence/parity.sh` already exists (committed in 77a134f, run once
as a negative control); main owns running it at C. No lane writes it. 010 no longer
mentions an uncommitted `.fp-parity.mjs` (checked: no match in 010).
The case contract L2 relies on is `parseCaseMarkdown` in 010, now listing `versions`
and `refs` explicitly.

L2 codes against the 010 export list. Until L1 lands, L2 may run its tests only after
L1's `core.test.mjs` and `cli.test.mjs` are self-contained: they do not import
`tests/helpers.mjs` (L2-owned) and define their own small runtime/git helpers, so L1
can run its tests before L2 lands.
L1 reports; main integrates, runs the full suite, and commits in dependency order:
core (L1) → server (L2) → CI/docs (main). Lane reports must name every file written and
the exact test commands run with exit codes; main verifies by diff and by rerunning.

## Acceptance for wp2 (checked at C)

1. `node --test tests/core.test.mjs tests/mcp.test.mjs tests/auto-update.test.mjs tests/cli.test.mjs`
   exits 0 under Node, and again with `FP_MCP_RUNTIME=bun` (c-1).
2. `bash devlog/260923_mcp-server/evidence/parity.sh` exits 0: 84 comparisons, no DIFF (c-2).
3. `bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs && bun scripts/lint-cases.mjs` exit 0.
4. `scripts/mcp.mjs` <= 300 lines; no dependency added; `git diff --check` clean.
5. An independent sol reviewer reads the diff against 010–012 before C closes.
