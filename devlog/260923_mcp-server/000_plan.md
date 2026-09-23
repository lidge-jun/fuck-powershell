# 260923 MCP server — plan

## Summary for a reader who was not here

The corpus is queried today through `scripts/fp.mjs`, a Bun-only CLI, and through a
skill that is installed by copy and therefore goes stale. This unit adds a
zero-dependency stdio MCP server (`scripts/mcp.mjs`) over the same lookup logic, so an
agent host can call `fp_preflight`, `fp_search`, `fp_errors` and `fp_case` directly
and get a few hundred bytes back instead of loading 311 KB of skill references.

The server reads the corpus from its own git checkout on every call, so updating the
checkout updates the server's answers without reinstalling anything. With
`FP_AUTO_UPDATE=1` it also fast-forwards that checkout in the background, and only
when the tree is clean and not diverged. The server code itself changes rarely; a new
version takes effect the next time the host starts the process.

MCP moved to a stateless revision (2026-07-28) that removed `initialize`, while
today's hosts still send it. The server speaks both (see 001).

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | satisfy-spec, three dependency-ordered work-phases under one HOTL goal |
| Trigger | User: build it on a new `dev` branch, open a PR, deploy; use sol subagents; check the MCP standard through Aside |
| Goal | MCP server merged to main with hosted CI green on ubuntu and windows, Pages deploy green, and the server registered and answering in local Codex |
| Non-goals | Case content, the stashed module-cache WIP, docs-site UI, npm publishing, a remote (Pages-served) data mode, thinning `references/` |
| Verifier | `node --test tests/*.test.mjs` (node and `FP_MCP_RUNTIME=bun`), the one-shot CLI parity script in 010, corpus `build-graph`/`validate-graph`/`lint-cases`, GitHub check-runs read by head SHA, Pages run conclusion by merge SHA, and a stdio smoke through the command `codex mcp get` reports |
| Stop condition | wp3's D closes with all six goalplan criteria carrying evidence |
| Memory artifact | `devlog/260923_mcp-server/` |
| Expected terminal outcomes | DONE = merged, deployed, registered. BLOCKED = GitHub Actions/Pages failure outside this repo after one diagnosis. UNSAFE = merge needs a force-push or history rewrite of main. NEEDS_HUMAN = registration needs an interactive step |
| Escalation condition | A CI failure rooted in the existing docs build, or any credential the session lacks |
| Resource bounds | Write scope: `scripts/`, `tests/`, `.github/workflows/ci.yml`, `README.md`, `skills/powershell-landmines/SKILL.md`, this unit. External writes authorized by the user: push `dev`, PR dev→main, merge, local Codex config (backed up first), a clean clone at `~/.fuck-powershell` for the registered server. No token or wall-clock budget was set |

## Work-phase map (dependency order)

| wp | Doc | Consumes | Produces |
|---|---|---|---|
| wp1 | 000, 001 (this cycle, docs only) | user request, spec pages | locked roadmap |
| wp2 | 010 core + CLI, 011 server, 012 tests/CI/docs | 001 spec facts | code on `dev`, local tests green, parity evidence |
| wp3 | 020 delivery | wp2 commits | PR, hosted CI, merge, Pages deploy, local registration |

Inside wp2 the build order is core (010) → server on the core (011) → tests, CI and
docs that exercise both (012). Each closes with something runnable.

## Architect consultation

Handle: `01a0cd6d-ebcf-7170-89d9-2e2a1a00bd31` (gpt-6-sol, `CXC-ROLE: architect`,
V1 `multi_agent_v1` transport with cxc-dev and dev-architecture attached).
Proposal received 2026-09-23 with decisions D1–D7.

| ID | Proposal | Main disposition |
|---|---|---|
| D1 | `scripts/lib/fp-core.mjs` exports buildGraph/createIndex/search/preflight/errors/getCase; build-graph keeps file writing; CLI keeps parsing/rendering | **Accept** |
| D2 | CLI bytes preserved; `import.meta.dir` → `fileURLToPath(import.meta.url)` | **Accept.** Graph enumeration keeps `readdirSync` order (no sorting) because sorting would reorder score ties and break parity. Dropping the `execSync` build of `graph.json` from fp.mjs is a side-effect change only; stdout is unchanged |
| D3 | In-memory snapshot, signature = content hash of every case/concept file, checked before each call | **Amend:** signature = sorted `relpath:size:mtimeMs` over the same files. ~400 files hashed per call is avoidable; git checkouts and pulls rewrite mtimes, and a same-size same-mtime edit is not a realistic case for this corpus |
| D4 | Four tools, `additionalProperties:false`, JSON text + structuredContent, fp_case default = bounded Symptom/Cause/Workaround | **Amend:** text content is a compact human rendering (fewer tokens than JSON); structuredContent carries the JSON. fp_case sections are returned whole with Repro omitted by default; no truncation, so a workaround is never cut |
| D5 | Dual-era dispatch, modern 2026-07-28 + legacy 2025-11-25/2025-06-18/2025-03-26/2024-11-05 | **Accept** with one simplification: a request carrying modern `_meta` with any supported version is served statelessly (tool semantics do not differ by version), so `supportedVersions` lists all five |
| D6 | FP_AUTO_UPDATE, 6 h throttle, stamp in a cache dir keyed by root hash, exclusive lock, run before a query | **Amend:** run in the background (startup + on calls when the throttle has expired) and never block a tool call; no cross-process lock, since git's own `index.lock` plus fail-soft handling already covers two servers racing. Git runs with `GIT_TERMINAL_PROMPT=0` and a timeout so a credential prompt cannot hang the server |
| D7 | node:test under Node and Bun; CI ubuntu+windows, Node 18/20/22 + Bun; keep `references/` | **Amend:** Node 18 and 22 (20 adds little), Bun on both OSes. Keep `references/` |

Reflection: three rounds, final **ALIGNED**; gaps and dispositions in 002.

## Scope boundary

IN: `scripts/lib/fp-core.mjs` (NEW), `scripts/lib/auto-update.mjs` (NEW),
`scripts/mcp.mjs` (NEW), `scripts/fp.mjs` and `scripts/build-graph.mjs` (MODIFY),
`tests/` (NEW), `.github/workflows/ci.yml` (NEW), `README.md` and
`skills/powershell-landmines/SKILL.md` (MODIFY), this devlog unit.

OUT: `cases/`, `ontology/concepts/`, `docs-site/`, `deploy.yml`,
`skills/powershell-landmines/references/`, `.codexclaw/`, the untracked WIP files.

## SoT sync target

`README.md` "How it fits together" table gains an MCP row, and the skill's lookup
section names the MCP tools first. The repo has no separate architecture index.

## Cycle log

**wp1 D (roadmap locked).** The roadmap is 000–020 as committed in e576dd0. The spec
check changed the design more than anything else: MCP 2026-07-28 removed `initialize`
and `ping`, so the server is dual-era rather than a copy of the codemode server's
2024-11-05 handshake. The audit's biggest catch was that the working tree carries an
untracked WIP case, so a naive parity run would compare different corpora; parity now
runs in two isolated archives. What did not get settled: which era Codex actually sends
is still an assumption until wp3's smoke observes it. Next: wp2 P re-verifies 010–012
against the tree, then a sol implementer builds them.

**wp2 D (implemented, local gates green).** Two sol lanes built the core/CLI and the
server/updater in parallel against the 010 interface; main wrote CI and docs. Main
rejected one lane decision: L1 had matched the old tie order by spawning `bun` from
Node to borrow its directory order, a hidden runtime dependency inside a
zero-dependency server. The graph now sorts names, which changes which equal-score case
appears at a cutoff in 7 of 14 parity queries versus the old Bun-on-macOS output (010
"Tie order amendment"); running the old scripts with sorted enumeration reproduces the
new output byte for byte. The independent C reviewer (sol) found five real defects
(bad-id handling, dirty corpus labeled with a clean SHA, an unguarded signature read,
a parity check loose enough to pass real changes, weak assertions); all were fixed and
re-verified. Local proof at f7f41b9: node 26/26, bun 26/26, parity 126/126, corpus
gate 112 cases 0 warnings. Not yet proven: Node 18 and Windows, which only hosted CI
exercises. Next: wp3 delivery per 020.
