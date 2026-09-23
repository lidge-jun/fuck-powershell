# 012 — wp2 part 3: tests, CI, README and skill

Depends on: 010, 011. Produces `tests/`, `.github/workflows/ci.yml`, doc edits.

## NEW `tests/helpers.mjs`

- `ROOT` via `fileURLToPath(new URL("..", import.meta.url))`.
- `RUNTIME = process.env.FP_MCP_RUNTIME || process.execPath` (CI sets `bun`).
- `startServer({ env, root })` spawns `[RUNTIME, join(root ?? ROOT, "scripts/mcp.mjs")]`
  with `stdio: ["pipe","pipe","pipe"]`, `windowsHide: true`; collects stdout lines;
  `request(method, params, { modern = true })` assigns ids and resolves on the matching
  response (5 s timeout); `modern` injects `_meta` {protocolVersion 2026-07-28,
  clientCapabilities {}, clientInfo}; `raw(line)` writes an arbitrary line; `close()`
  ends stdin and resolves with the exit code; `lines` exposes every stdout line.
- `git(cwd, ...args)` runs git with `-c core.autocrlf=false -c user.name=t -c user.email=t@t`
  and `GIT_TERMINAL_PROMPT=0`.

## NEW `tests/mcp.test.mjs` (node:test, node:assert/strict)

| test | activation | observable proof |
|---|---|---|
| discover | modern `server/discover` | resultType complete, supportedVersions has 2026-07-28 and 2025-11-25, ttlMs, cacheScope, _meta serverInfo |
| tools/list modern | two calls | 4 tools in order preflight/search/errors/case, identical JSON both times, ttlMs + cacheScope |
| missing _meta | `tools/list` with no _meta and no initialize | error -32602 whose message names protocolVersion |
| caps missing | _meta with version only | -32602 |
| unsupported version | version 1900-01-01 | -32022, data.supported includes 2026-07-28, data.requested |
| legacy handshake | initialize 2025-06-18 | protocolVersion echoed 2025-06-18; then `notifications/initialized`, `tools/list` without _meta works and has no resultType |
| legacy fallback version | initialize 1999-01-01 | protocolVersion 2025-11-25 |
| every advertised version | for each of the 5 SUPPORTED: modern `tools/list` with that `_meta` version; for each of the 4 LEGACY: a fresh process `initialize` with it | modern: resultType complete; legacy: version echoed |
| ping | legacy ping → {}; modern ping | {} ; -32601 |
| unknown method | `foo/bar` | -32601 |
| unknown tool / bad args | `fp_nope`; fp_search with {} ; fp_case with {id:"x", extra:1}; fp_preflight operation "teleport" | -32602 each |
| preflight | node/spawn/npm | isError false, structuredContent.risk "high", text contains `spawn-npm-enoent-einval` and `corpus ` header |
| search | "iex exit terminal" | at least one hit |
| errors | "einval" and "error-einval" | same case ids |
| case default | curl-alias | text has Symptom and Workaround, lacks "## Repro", ends with the omission note |
| case full | curl-alias full:true | text has "## Repro" |
| case unknown | "not-a-case" | isError true |
| parse error | raw `{not json` | -32700 with id null, server keeps serving the next request |
| invalid request | raw `[1]` and raw `"str"` | -32600 with id null each |
| _meta type error | protocolVersion `5` with clientCapabilities {} | -32602 |
| arg type / pattern | fp_case `{id:"curl-alias", full:"yes"}`; fp_case `{id:"../etc"}`; fp_search `{query:""}` | -32602 each, message names the field |
| stdout purity | after all above | every stdout line JSON-parses and has jsonrpc "2.0" |
| EOF | close stdin | exit code 0 within 5 s |
| corpus change | copy scripts/, cases/, ontology/concepts/ to a temp dir, start there, count; add a copied case under a new name; call again | caseCount + 1 without restarting |
| case refs | fp_case curl-alias | structuredContent.case.refs has the two URLs from the frontmatter |
| head freshness | temp git repo copy of the corpus; call; commit a README change; call | header SHA changes on the second call, caseCount unchanged |
| rebuild failure with prev | temp corpus; call; corrupt a concept file (drop its `type:`); call | isError false, header has `warning: corpus rebuild failed`, cases still returned |
| first-call failure | fresh server on a temp corpus with a corrupt concept file | isError true, text names the concept file |

## NEW `tests/core.test.mjs`

`loadSnapshot` rules from 011 on a temp git copy of the corpus: busy with prev → prev's
index returned without a rebuild and `head === prev.head`; busy after a new commit →
`head === prev.head` and `checkoutHead` is the new SHA; unchanged signature after a
README-only commit → prev's index with `head` = new SHA; a file touched between two
calls → rebuilt with the new count; a concept file made invalid → prev index kept with
`warning` starting "corpus rebuild failed" and `sig: null`, then fixed → rebuilt
without a warning. The "tree moved during the read"
branch is exercised by passing a test-only `onBuilt` hook that rewrites a case file on
every build: with prev → prev is returned with `sig === null` and a warning; without
prev → throws "corpus is changing". A hook that rewrites only on the first build → the
retry's stable index is returned.

## NEW `tests/auto-update.test.mjs`

Builds a temp bare "origin", a clone, and a second clone that pushes new commits. Uses
`createUpdater` directly with `enabled: true`, `intervalMs: 0`, a temp `stateDir`.

| test | setup | expected `run()` outcome |
|---|---|---|
| behind + clean | push a commit from clone 2 | `updated`, clone HEAD equals origin |
| up to date | nothing new | `up-to-date` |
| dirty | untracked file in clone | `skipped:dirty`, HEAD unchanged |
| diverged | local commit + remote commit | `skipped:diverged`, HEAD unchanged |
| no upstream | `git switch -c lonely` | `skipped:no-upstream` |
| detached | `git switch --detach` | `skipped:detached` |
| fetch failed | injected `exec` failing `fetch` (real repo otherwise) | `skipped:fetch-failed`, HEAD unchanged |
| merge failed | injected `exec` failing `merge` on a behind clone | `skipped:merge-failed`, HEAD unchanged |
| no git | injected `exec` rejecting with `code: "ENOENT"` | `skipped:no-git` |
| git error | injected `exec` rejecting with `code: "EACCES"` at step 3 | `skipped:git-error` |
| busy | injected `exec` whose `fetch` waits on a promise the test controls | `busy()` true while pending, false after settle |
| throttle | `intervalMs: 3600000`, two `kick()` calls after a first `run()` | second kick does not start a run (status unchanged, stamp lastAttempt unchanged) |
| disabled | `enabled: false` | `kick()` never writes a stamp |

## NEW `tests/cli.test.mjs`

Runs `scripts/fp.mjs` under `RUNTIME`: `preflight ... --json` parses with risk high;
`case not-a-case` exits 1 with `unknown case not-a-case` on stderr; no command exits 0
with the usage line; `bogus` exits 1.

## NEW `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main, dev]
permissions:
  contents: read
jobs:
  corpus:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs && bun scripts/lint-cases.mjs
  mcp-node:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [18, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: node --test tests/core.test.mjs tests/mcp.test.mjs tests/auto-update.test.mjs tests/cli.test.mjs
  mcp-bun:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: oven-sh/setup-bun@v2
      - run: node --test tests/core.test.mjs tests/mcp.test.mjs tests/auto-update.test.mjs tests/cli.test.mjs
        env: { FP_MCP_RUNTIME: bun }
```

Explicit file lists avoid the directory-argument difference between Node 18 and 22's
test runner. The `run` lines are one command each, so the default shell on Windows
(`pwsh`) and Linux (`bash`) parse them the same way; the corpus job's `&&` runs on
bash only.

## MODIFY `README.md`

- "How it fits together" table: new row `| MCP server | four read-only tools over the same
  engine, zero dependencies, dual-era MCP (2026-07-28 + initialize) | scripts/mcp.mjs |`.
- New section "Use it as an MCP server" after "Query before you patch": clone, then

  ```
  codex mcp add fuck-powershell --env FP_AUTO_UPDATE=1 -- node ~/.fuck-powershell/scripts/mcp.mjs
  claude mcp add fuck-powershell -e FP_AUTO_UPDATE=1 -- node ~/.fuck-powershell/scripts/mcp.mjs
  ```

  (absolute path in practice; `bun` works in place of `node`), the tool list, and the
  update model in three sentences: answers come from the checkout on every call;
  `FP_AUTO_UPDATE=1` fast-forwards a clean, non-diverged checkout at most every 6 h in
  the background; a changed server script takes effect when the host restarts it. Keep a
  dedicated clone for this so your working checkout is never pulled under you.

## MODIFY `skills/powershell-landmines/SKILL.md`

Insert before "## Dynamic lookup (preferred)" a section "## MCP tools (preferred when
registered)": if `fp_preflight`/`fp_search`/`fp_errors`/`fp_case` are available, use
them with the same operations and the same risk rules; the CLI below is the fallback.
Rename the next heading to "## CLI lookup". Nothing else in the skill changes.
