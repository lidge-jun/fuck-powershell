# 000 — Ontology schema lock (ow1)

Direction source: reviewed initiative (devlog attachment 260825) — cases stay
canonical; ontology entities only for SHARED concepts; graph.json/INDEX.md are
generated; validator enforces integrity; skill becomes a QUERY skill backed by
the pulled repo; fp.mjs is the lookup engine.

## Scope amendment (user, 260825): Windows failure corpus

The corpus explicitly covers ALL Windows automation failures agents step on —
not only PowerShell semantics. fuck-powershell stays the brand; the corpus is
"Windows shell & process interoperability hazards". Concretely:
- Node/Bun spawn semantics (ENOENT/EINVAL/EPERM), PATHEXT, WindowsApps aliases,
  cmd.exe parsing, Win32 path rules (MAX_PATH, trailing dots/spaces, reserved
  names, backslash), registry env, NTFS quirks (ADS, case, junctions), CRLF,
  code pages, GitHub Actions runner behavior — all in scope as first-class cases.
- New Environment/Concept nodes: env-win32-api, concept-max-path,
  concept-reserved-names, concept-mark-of-the-web, runtime-bun, runtime-go.
- Category set may grow (e.g. win32-fs, spawn) — folder = category rule stays;
  the ontology 'affects' edges carry the cross-cutting layer instead of
  forcing everything into PowerShell buckets.
- README/site copy updated to state the widened scope (issue #2/#5-style cases
  are already in-scope precedents, and the rejected NTFS/ADS + MAX_PATH commits
  from the 260824 mining sweep become ELIGIBLE — logged as backlog in 010).

## Audit synthesis (round 1 FAIL — all 7 blockers accepted, fixes below)

B1 id namespace: graph node ids are TYPED — every node carries explicit
{id, type}; Case nodes get graph id "case:<file-stem>" (files unchanged), concept
nodes get "concept-file id" but their TYPE comes from the concept file's own
frontmatter \`type:\` field, never prefix inference. V2 checks type field ∈ enum.
B2 V6 exception: manifests_as required ONLY when failure != silent. Silent cases
may have zero error signatures; fp errors covers only signature-bearing cases.
B3 parser: build-graph.mjs gets its OWN indent-aware frontmatter parser for the
nested ontology block. lint-cases stays untouched (verified: it skips nested
lines harmlessly). sync-cases gets the same shared parser via import for chips.
B4 preflight map: explicit operation enum + flag→node table (in 020). npm
multi-hit is CORRECT behavior (ranked multi-return), not a collision.
B5 vocab: drop \`documents\` (redundant inverse); related_to stored one-way,
symmetric at query time; Command scope widened to cmdlets/operators/native
commands (command-ne, command-get-content legal); V9 tightened → unsafe_fix
target concept MUST contain "## Why it's unsafe" (concept-side, enforceable);
V10 downgraded to WARN for planned-but-unreferenced concepts.
B6 generate-don't-commit: graph.json + INDEX.md are .gitignored build artifacts,
emitted+gated inside the docs-site build chain (exact chain in Generated
artifacts section below); no committed copy.
B7 canonical leak: concepts carry ONLY Definition (<=3 sentences) + optional
"## Why it's unsafe"; никогда case-prose restating. Case FM is the only edge
source. SKILL references stay generated.

## Node types (locked)

| type | graph id | canonical source |
|---|---|---|
| Case | case:<file-stem> (type from provenance, not prefix) | cases/<cat>/<id>.md (existing) |
| Runtime | runtime- | ontology/concepts/*.md |
| Shell | shell- | concepts (shell-powershell-51, shell-pwsh-7, shell-cmd, shell-gitbash) |
| Command | command- | concepts (command-npm, command-curl, command-explorer...) |
| Mechanism | mechanism- | concepts (mechanism-pathext-resolution, mechanism-native-argv-rebuild, mechanism-stream-wrapping, mechanism-bom-sniffing, mechanism-collection-unrolling, mechanism-registry-env-snapshot...) |
| ErrorSignature | error- | concepts (error-enoent, error-einval, error-eperm, error-eftype, error-nativecommanderror, error-pssecurityexception, error-parsererror...) |
| Workaround | workaround- | concepts (workaround-comspec-dispatch, workaround-lastexitcode-gate, workaround-utf8-bom, workaround-sid-principal...) |
| Environment | env- | concepts (env-windows, env-actions-runner, env-korean-codepage) |
| Concept | concept- | concepts (concept-pathext, concept-execution-policy, concept-success-stream...) |

## Edge vocabulary (locked, 9)

affects (Case→Runtime|Shell|Environment), invokes (Case→Command; Command covers
cmdlets/operators/native binaries), manifests_as (Case→ErrorSignature),
caused_by (Case→Mechanism), mitigated_by (Case→Workaround),
unsafe_fix (Case→Workaround), related_to (stored one-way, symmetric at query;
endpoints: Case|Concept|Mechanism ↔ Case|Concept|Mechanism — V5 legal set),
supersedes (Workaround|Case→same type), requires (Workaround→Runtime|Shell|Environment).

## Case frontmatter extension (source of Case edges)

\`\`\`yaml
ontology:
  affects: [runtime-node, shell-powershell-51]
  invokes: [command-npm]
  manifests_as: [error-enoent, error-einval]   # REQUIRED only when failure != silent (V6)
  caused_by: [mechanism-pathext-resolution]     # REQUIRED always (V7)
  mitigated_by: [workaround-comspec-dispatch]
  unsafe_fix: [workaround-shell-true]
\`\`\`

caused_by required for all; manifests_as required unless failure: silent (B2).
Existing category/versions/failure/context stay untouched.

## Validator gates V1-V11

V1 unique node ids; V2 node type field ∈ enum (no prefix inference); V3 no
dangling edges; V4 edge names in vocabulary; V5 edge direction legal per table;
V6 every Case with failure != silent has >=1 manifests_as; V7 every Case has
>=1 caused_by; V8 every concept has non-empty "## Definition" (<=400 chars);
V9 every concept targeted by any unsafe_fix edge has "## Why it's unsafe";
V10 WARN on unreferenced concepts; V11 case node set (after stripping the
"case:" graph-id prefix) == case file stems on disk.

## Generated artifacts

ontology/graph.json {nodes:[{id,type,label,file}], edges:[{from,rel,to,src}]},
ontology/INDEX.md (per-type listing + error reverse index). BOTH GITIGNORED —
generated in the docs-site build chain: package.json build =
"build-graph && validate-graph && lint && sync && sync-ontology && astro build"
(build-graph emits, validate-graph gates, no committed copy, no drift).

## Concept id ledger (020 alignment)

Mechanisms named by 020's operation map are all in the concept set:
mechanism-pathext-resolution, mechanism-cmd-reparse, mechanism-registry-env-
snapshot, mechanism-bom-sniffing, mechanism-default-encoding, mechanism-stream-
wrapping, mechanism-exit-code-propagation, mechanism-native-argv-rebuild,
mechanism-collection-unrolling, mechanism-execution-policy-gate,
mechanism-alias-shadowing, mechanism-strictmode-contract.
concept-path-resolution, concept-execution-policy, concept-pathext,
concept-success-stream, concept-max-path, concept-reserved-names.
