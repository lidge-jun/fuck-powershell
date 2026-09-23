# 010 — wp2 part 1: fp-core and the CLI on top of it

Depends on: nothing new. Produces: `scripts/lib/fp-core.mjs`, a Node-compatible
`scripts/fp.mjs` with unchanged output, `scripts/build-graph.mjs` delegating to the core.

## NEW `scripts/lib/fp-core.mjs`

Pure functions plus two small IO helpers. No dependencies beyond `node:` builtins and
`./frontmatter.mjs`. Runs on Node >= 18 and Bun.

```js
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseFrontmatter } from "./frontmatter.mjs";

export const EDGE_KEYS = [...];        // moved verbatim from build-graph.mjs:10
export const OPERATION_MAP = {...};    // moved verbatim from fp.mjs:20-29
export const RUNTIME_MAP = {...};      // fp.mjs:30
export const WEIGHT = {...};           // fp.mjs:31

// Corpus root: FP_HOME when it holds cases/, else <dir of fromUrl>/.. (scripts/ -> repo)
export function resolveRoot(fromUrl, env = process.env)

// Body of build-graph.mjs:12-36 returning { generated, nodes, edges }.
// Keeps readdirSync enumeration order (no sort) for byte parity with the old CLI.
// Throws Error("concept missing id/type: <f>") where the script used to exit(1).
export function buildGraph(root)

// { graph, byId: Map, caseEdges: Map } exactly as fp.mjs:14-16 builds them
export function createIndex(graph)

// fp.mjs:47-56 without printing: returns [{ id, title, file, category, failure, score }]
// id is the stem (no "case:"), top 8, same scoring and sort.
export function search(ix, text)

// fp.mjs:58-94 without printing: returns { risk, cases, constraints } where cases are
// caseInfo + { score, reason } -- the exact object the CLI serializes with --json.
export function preflight(ix, { runtime, operation, target, shell } = {})

// fp.mjs:105-109: returns { signature: "error-x", cases: [caseInfo] }
export function errors(ix, sig)

// { ...caseInfo, markdown } or null
export function getCase(ix, root, id)

// Splits a case body on "## <Name>" headings; tolerant of \r\n. Returns
// { frontmatter, title, versions, refs, sections: { Symptom, Repro, Cause, Workaround, ... } }
// title = first "# " heading (fallback frontmatter.title); versions = frontmatter.versions
// (string or null); refs = string[] (regex rule below; [] when absent); section text is
// the body under "## <Name>" up to the next "## ", trimmed, with \r\n normalized to \n.
// refs: parseFrontmatter drops top-level dash lists (it returns refs: {} --
// frontmatter.mjs:24-27 opens a nested object and never sets listKey), so refs are read
// with a regex over the frontmatter block: the "- <url>" lines after "refs:" until the
// next unindented key. frontmatter.mjs is NOT modified (the graph depends on it).
export function parseCaseMarkdown(markdown)

// Sorted "relpath:size:mtimeMs" lines over cases/**/*.md and ontology/concepts/*.md,
// joined with "\n". Cheap change detector for the server (000 D3 disposition).
export function corpusSignature(root)

// git -C root rev-parse --short HEAD via spawnSync(argv, no shell, timeout 5000,
// windowsHide). Returns null on any failure.
export function gitHead(root)

// Stable-read rule used by the server; see 011 "Corpus state".
// Returns { sig, ix, head, checkoutHead, caseCount, warning? }; see 011 rule 5 for head.
// Throws when no usable index exists (first-call failure or unstable without prev).
export function loadSnapshot(root, prev, { isBusy = () => false, onBuilt } = {})
```

`caseInfo(ix, gid)` stays internal and returns `{ id, title, file, category, failure }`
as fp.mjs:41-44 does.

## MODIFY `scripts/fp.mjs`

- Replace `import.meta.dir` (fp.mjs:12) with
  `const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")`.
- Delete the `graph.json` existence check and `execSync` build (fp.mjs:13-14) and the
  inline index (fp.mjs:15-17); use `createIndex(buildGraph(ROOT))`.
- Each command calls the core and keeps its current printing:
  - search: `console.log(score + "  " + id + "  (" + file + ")")` per hit, else `no matches`.
  - preflight: `console.log(f.json ? JSON.stringify(out, null, 2) : renderPreflight(out))`.
  - case: unknown → `console.error("unknown case " + id); process.exit(1)`; else print the file.
  - errors: `no cases manifest <sig>` or `<id>  (<file>)` lines.
  - usage line and exit codes unchanged.
- Shebang stays `#!/usr/bin/env bun`; the file now also runs under `node`.

## MODIFY `scripts/build-graph.mjs`

Keep the shebang, ROOT via `fileURLToPath`, call `buildGraph(ROOT)` (catch the concept
error → `console.error(msg); process.exit(1)`), then write `graph.json` and
`INDEX.md` exactly as lines 35-48 do today. The INDEX.md renderer stays in this script.

## Parity proof (c-2), run once in C

### Tie order amendment (B-phase finding, 2026-09-23)

Byte parity with the old CLI turned out to be the wrong target for one thing: the order
of equal-score results. The old CLI inherited it from `readdirSync`, and that order is
not a property of the corpus: on macOS Bun returns raw APFS order while Node returns
names sorted, and Linux ext4 or NTFS give other orders again. The L1 lane first matched
it by spawning `bun` from Node to borrow Bun's enumeration, which hid a runtime
dependency inside a zero-dependency server; main rejected that. `buildGraph` now sorts
category, case and concept names, so every runtime and OS builds the same graph.

Consequence, recorded rather than hidden: against the old Bun-on-macOS output, 7 of the
14 parity queries order their ties differently. Where ties straddle a cutoff (top 3 for
constraints, top 6 for preflight, top 8 for search) a different equal-score case is
shown. Example, `preflight --runtime node --operation spawn --target npm`: the
3-point tie now lists `cmd-shim-reparses-argv` instead of `npm-script-runs-under-cmd`,
and the constraints lose "absolute spawn" and "skip relative path entries". Scores,
risk levels, stderr and exit codes are unchanged.

`evidence/parity.sh` therefore checks three things. New Bun vs new Node: byte-identical.
The old scripts run under Node with `readdirSync` sorted by a preload (and
`import.meta.dir` rewritten so Node can load them) vs new: byte-identical, which proves
sorted enumeration is the only behavior change. Old Bun vs new: stderr and exit code
byte-identical; stdout may differ only in which equal-score items appear (same risk
line, same score sequence), and those queries are listed as TIE-ORDER.
Result at 07fb082 + C fixes: 126 comparisons, fail=0, 7 TIE-ORDER.

Both sides run against one isolated, identical corpus so the untracked WIP case in the
working tree (113 files vs 112 at b59324b) cannot leak into either side:

1. `git archive b59324b | tar -x -C $T/old` and the same into `$T/new`.
2. Copy the working-tree `scripts/` (the refactor) over `$T/new/scripts/`.
3. In `$T/old`: `bun scripts/build-graph.mjs` (the old CLI reads `graph.json`).
   In `$T/new`: nothing (the new CLI builds in memory).
4. For each query below run old with `bun`, new with `bun` and with `node`, each from
   its own tree as cwd, and compare stdout, stderr and exit status byte for byte.

The executable procedure is committed as `evidence/parity.sh` in this unit: it creates
`$T/old`, `$T/new`, `$T/out` under `mktemp -d`, extracts both archives, copies the new
`scripts/`, builds the old graph, captures `.out`/`.err`/`.code` per query for
`old` (bun), `newbun` and `newnode`, and `cmp`s every old file against both new
runs; exit 1 and a `DIFF <label> <n>.<kind>` line on any mismatch. Query set:

```
preflight --runtime node --operation spawn --target npm
preflight --runtime node --operation spawn --target npm --json
preflight --runtime powershell --operation encoding
preflight --runtime powershell --shell 7 --operation redirect --target python
preflight --operation ci
search iex exit terminal
search zzzz-no-hit
errors einval
errors error-enoent
errors nothing-here
case curl-alias
case not-a-case
(no command)
bogus
```

Any byte difference is a C failure. The script keeps its temp tree and prints the path
(useful when a DIFF needs reading); its summary line is saved as
`devlog/260923_mcp-server/evidence/010_parity.txt`. Pre-implementation run on
2026-09-23: `newbun` 42/42 identical, `newnode` all different because the old
`fp.mjs` uses `import.meta.dir`, which is undefined under node, so the check is shown to
detect differences.

Verifier reality (PLAN-VERIFIER-REAL-01): `bun scripts/fp.mjs preflight --runtime node
--operation spawn --target npm` was run on b59324b and exits 0; it reads
`scripts/fp.mjs` directly, which is the change target.
