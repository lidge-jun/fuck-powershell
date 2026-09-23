# 011 — wp2 part 2: the MCP server

Depends on: 010 (fp-core), 001 (spec facts). Produces `scripts/mcp.mjs` and
`scripts/lib/auto-update.mjs`.

## NEW `scripts/mcp.mjs` (target <= 300 lines)

Shebang `#!/usr/bin/env node`. Runs as `node scripts/mcp.mjs` or `bun scripts/mcp.mjs`.

### Constants

```js
const SERVER_INFO = { name: "fuck-powershell", version: "0.1.0" };
const MODERN = ["2026-07-28"];
const LEGACY = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SUPPORTED = [...MODERN, ...LEGACY];
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_CAPS = "io.modelcontextprotocol/clientCapabilities";
const META_SERVER = "io.modelcontextprotocol/serverInfo";
const LIST_TTL_MS = 3_600_000;             // tools never change within a process
const INSTRUCTIONS = "Windows shell/process landmine corpus. Call fp_preflight BEFORE writing code that spawns processes, touches PATH/env, encodings, redirects, exit codes, quoting, installers or Windows CI; read the top case with fp_case. fp_errors maps an error signature (einval, enoent, eperm...) to cases.";
```

### Transport

- stdin `setEncoding("utf8")`, buffer, split on `\n`, strip a trailing `\r`, skip blank
  lines. Each line → `JSON.parse`; failure → `{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}`.
- A non-object or array message → -32600 Invalid Request (id when present, else null).
- `send(obj)` writes `JSON.stringify(obj) + "\n"` to stdout. JSON.stringify never emits
  a raw newline, so the no-embedded-newline rule holds by construction.
- All diagnostics go to `process.stderr` prefixed `[fp-mcp]`. Nothing else touches stdout.
- `stdin.on("end")` → `process.exit(0)`. The updater runs child processes with
  timeouts, so exit does not need to wait for it.

### Dispatch

```
message without id (notification):
  notifications/initialized  -> no-op
  notifications/cancelled    -> no-op (every handler is synchronous; nothing to cancel)
  anything else              -> ignored
request:
  method === "initialize":
    legacy = true
    v = params.protocolVersion
    result { protocolVersion: LEGACY.includes(v) ? v : LEGACY[0],
             capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS }
  else:
    meta = params?._meta
    if meta has META_VERSION:                      # modern, stateless
      if typeof meta[META_VERSION] !== "string"
         or meta[META_CAPS] is not a plain object -> -32602 "Invalid params: _meta requires <keys>"
      if !SUPPORTED.includes(version)            -> -32022 "Unsupported protocol version",
                                                    data { supported: SUPPORTED, requested: version }
      mode = "modern"
    else if legacy                                -> mode = "legacy"
    else                                          -> -32602 with message naming both paths:
         "missing _meta.io.modelcontextprotocol/protocolVersion; send it (2026-07-28) or initialize first (legacy: 2025-11-25 ...)"
    handler = { "server/discover", "tools/list", "tools/call", "ping" }[method] or -32601
    result = handler(params)
    if mode === "modern": result = { resultType: "complete", ...result,
                                     _meta: { [META_SERVER]: SERVER_INFO } }
```

Handlers:

- `server/discover` → `{ supportedVersions: SUPPORTED, capabilities: { tools: {} },
  instructions: INSTRUCTIONS, ttlMs: LIST_TTL_MS, cacheScope: "public" }` (serverInfo
  comes from the modern decoration; in legacy mode add `serverInfo` inline).
- `ping` → `{}` (legacy hosts use it; harmless for modern ones).
  Legacy mode only: 2026-07-28 removed `ping`, so a modern request for it gets -32601.
- `tools/list` → `{ tools: TOOLS, ttlMs: LIST_TTL_MS, cacheScope: "public" }`, TOOLS a
  frozen array in the fixed order preflight, search, errors, case.
- `tools/call` → validate, refresh the corpus, run, render (below).

### Tools

Every tool: `annotations: { readOnlyHint: true, openWorldHint: false }`, `title`,
schema `{ type: "object", properties, required?, additionalProperties: false }`.

| name | properties | required |
|---|---|---|
| fp_preflight | runtime enum [node, bun, powershell, cmd]; operation enum [spawn, env-path, encoding, redirect, exit-code, quoting, install, ci]; target string 1..64; shell enum ["5.1", "7"] | none |
| fp_search | query string 1..200 | query |
| fp_errors | signature string pattern `^[a-z0-9-]{1,64}$` (with or without `error-`) | signature |
| fp_case | id string pattern `^[a-z0-9-]{1,120}$`; full boolean | id |

Validation is hand-written against that table (no JSON-schema library). Unknown tool,
missing required, unknown property, wrong type, enum miss or pattern miss → JSON-RPC
-32602 with a message naming the field. These are protocol errors, per the tools page.

Execution-level outcomes are results. `fp_case` for an unknown id returns
`isError: true` with text `unknown case <id>; try fp_search`.

### Corpus state (000 D3)

```js
let state = null;   // { sig, ix, head, caseCount }
function corpus() {
  state = loadSnapshot(ROOT, state, { isBusy: updater.busy });
  return state;
}
```

`loadSnapshot(root, prev, { isBusy })` lives in fp-core (010) and is the stable-read rule
(reflection gap 2):

1. `isBusy()` true (this process's updater is inside `fetch`/`merge`) and `prev`
   exists → return `prev` without reading the tree.
2. `before = corpusSignature(root)`; equal to `prev.sig` → return `prev`.
3. Build the index, then `after = corpusSignature(root)`. If `before === after` the build
   is stable: cache it with `sig: after`. Otherwise the tree moved during the read and the
   index may mix old and new files, so it is discarded and the build is retried once. If
   the retry is also unstable: return `prev` (with `sig: null`, forcing a rebuild next
   call) when it exists, else throw `Error("corpus is changing; retry")`, which the tool
   call reports as `isError: true`. A mixed index is never served.
4. A `buildGraph` throw with `prev` present returns
   `{ ...prev, sig: null, warning: "corpus rebuild failed: <msg>; serving previous index" }`.
   The tool call succeeds (`isError: false`) with that warning as the second header line
   and in `structuredContent.freshness.warning`. Without `prev` the throw propagates and
   the call returns `isError: true` with the message. Same split for rule 3's unstable case.
5. Two SHAs, never conflated. `head` is the commit whose corpus the index answers for;
   `checkoutHead` is `gitHead(root)` re-read on every return path.
   - Fresh build (rule 3 stable): `head = checkoutHead` read before the build, and the
     build only counts as stable if `checkoutHead` is also unchanged after it.
   - Rule 2 (signature unchanged): the corpus files are identical, so the index is valid
     for the current commit: `head = checkoutHead`. A README-only commit therefore
     updates the header SHA.
   - Rules 1 and 4 and rule 3's fallback (serving `prev`): `head` stays `prev.head`;
     when `checkoutHead` differs the header reads
     `corpus <head> (checkout <checkoutHead>, rebuild pending)` and
     `structuredContent.freshness.checkoutHead` is set. Old answers are never labeled
     with the new commit.

Two server processes on one checkout: both may pass the checks; the second `merge
--ff-only` then finds nothing to do or fails on git's `index.lock` and records
`skipped:merge-failed`. Neither can move HEAD anywhere but the upstream fast-forward,
and rule 3 covers the reads.

ROOT = `resolveRoot(import.meta.url)`. Failure handling is rule 4 above: previous index
plus a warning when one exists, `isError: true` otherwise.

### Rendering (compact text; structuredContent carries the same data as JSON)

Header line on every tool result: `corpus <head|no-git> · <n> cases` plus
` · update: <outcome>` when auto-update is enabled.

- preflight: `risk: <level>`, then one line per case `<score> <id> — <title> [<reason,...>]`,
  then `constraints:` bullets, then `next: fp_case {"id":"<top id>"}` when any case matched.
- search: `<score> <id> — <title>` lines or `no matches`.
- errors: `<id> — <title> (<category>, <failure>)` lines or `no cases manifest <sig>`.
- case (default): `# <title>`, a line `<category> · versions <v> · <failure>`, then the
  Symptom, Cause and Workaround sections verbatim, then `refs:` URLs, then
  `(repro omitted; call with full:true)`. `full: true` returns the raw markdown.

structuredContent: `{ freshness: { head, caseCount, update }, ...coreResult }`
(for case: `{ freshness, case: { id, title, file, category, failure, versions, sections, refs } }`
or `{ freshness, case: {..., markdown} }` when full).

## NEW `scripts/lib/auto-update.mjs` (000 D6 disposition)

```js
export function createUpdater({ root, enabled, intervalMs, stateDir, log, now = Date.now, exec })
// returns { kick(): void, status(): string|null, busy(): boolean, run(): Promise<string> }
// exec(args) -> Promise<{ code, stdout }> defaults to execFile("git", ["-C", root, ...args]);
// tests inject it for deterministic fault injection (fetch/merge failure, no git).
```

- `enabled` = `FP_AUTO_UPDATE === "1"`; `intervalMs` = `FP_UPDATE_INTERVAL_MS` or 6 h;
  `stateDir` = `FP_STATE_DIR`, else `%LOCALAPPDATA%\\fuck-powershell` on win32, else
  `$XDG_CACHE_HOME/fuck-powershell` or `~/.cache/fuck-powershell`.
- Stamp file `<stateDir>/update-<sha256(root) first 16 hex>.json` =
  `{ lastAttempt, outcome }`.
- `kick()` starts `run()` when enabled, not already running, and the stamp is older than
  `intervalMs`; errors are caught and logged. Called once at startup and at the start of
  each `tools/call`; the call never awaits it.
- `run()` sequence, each git call via `execFile("git", ["-C", root, ...])` with
  `timeout: 20000`, `windowsHide: true`, env `GIT_TERMINAL_PROMPT=0`:
  This is `git pull --ff-only` split into its two halves (`fetch` then
  `merge --ff-only @{u}`) so the server can report *why* it did not update (dirty,
  diverged, no upstream) instead of one opaque pull failure. The goal's
  "git pull --ff-only" requirement means this behavior; nothing else merges or rebases.

| step | command | outcome on failure / condition |
|---|---|---|
| 1 | `symbolic-ref -q HEAD` | spawn error ENOENT → `skipped:no-git`; non-zero exit → `skipped:detached` |
| 2 | `rev-parse --abbrev-ref --symbolic-full-name @{u}` | fails → `skipped:no-upstream` |
| 3 | `status --porcelain` | non-empty → `skipped:dirty` |
| 4 | `fetch --quiet` | fails → `skipped:fetch-failed` |
| 5 | `rev-parse HEAD` vs `rev-parse @{u}` | equal → `up-to-date` |
| 6 | `merge-base --is-ancestor HEAD @{u}` | exit 1 → `skipped:diverged` |
| 7 | `merge --ff-only @{u}` | fails → `skipped:merge-failed`; success → `updated` |

  A spawn failure other than ENOENT at any step → `skipped:git-error`.
  The stamp is written after every attempt (including skips) so a dirty tree is not
  re-probed on every call. `status()` returns the last outcome or null.
- `busy()` returns true from the start of step 4 until `run()` settles.
- `FP_UPDATE_INTERVAL_MS=0` makes every `kick()` eligible; the delivery smoke (020) uses
  it and then polls `tools/call` until the header shows an `update:` outcome, bounded
  at 30 s.
- After `updated`, the next `corpus()` sees a new signature and rebuilds; nothing else
  is needed. Server code changes still require a host restart, which the README states.

Bypass record (PLAN-BYPASS-NAMED-01): tier E1 (advisory); executing surface is the
server process; known bypass is simply leaving `FP_AUTO_UPDATE` unset or a dirty tree;
residual risk is a stale corpus, surfaced in every result's header line; wording is
"opt-in best-effort update", never "enforcement". Final layer: none.
