# 260911 win-hooks round — plan

## Summary for a reader who was not here

A second Windows repair tool, [LilMGenius/win-hooks](https://github.com/LilMGenius/win-hooks),
documents 34 numbered Windows failures it detects and fixes in agent plugin hooks. It is
an independent witness to the same minefield this corpus covers, and it has seen
mechanisms we had not written down: the `bash.exe` on stock Windows PATH is the WSL
launcher on a machine without Git for Windows; a quoted path at the start of a line is an
*expression* to PowerShell, not a command; `%*` in cmd.exe ignores `shift`.

This round mines that repository and adds **10 cases**, taking the corpus from 98 to 108.
(The slate started at 11; see `001_audit_and_measurements.md` for the one that was
dropped and why.)
Nothing existing is rewritten except cross-links and the counts that go stale when the
corpus grows. For an agent, the change is that ten more "about to do X on Windows"
questions now return a case instead of nothing.

## Loop spec

| Field | Value |
|---|---|
| Loop archetype | satisfy-spec — a fixed slate of 10 mined cases, each passing the same three gates |
| Trigger | User request: mine `LilMGenius/win-hooks`, add cases via parallel `xai/grok-4.6` subagents, merge to main |
| Goal | 10 new schema-valid, graph-valid, publicly cited cases on local `main`, with the skill and the counts regenerated |
| Non-goals | No new category, edge verb, or node type. No change to `lint-cases.mjs` / `build-graph.mjs` / `validate-graph.mjs`. No docs-site redesign. No `git push`. No mining of win-hooks entries that are host-policy or win-hooks-engine defects rather than Windows defects |
| Verifier | `bun scripts/lint-cases.mjs` (walks every `cases/**/*.md`, so it observes all 10), `bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs` (V1-V11 over the regenerated graph), `bun scripts/install-skill.mjs --check` (installed-copy drift) |
| Stop condition | wp5's D closes with the merge on local `main` and all seven goalplan criteria carrying captured evidence |
| Memory artifact | This unit, `devlog/260911_winhooks/`, plus the goalplan under `.codexclaw/goalplans/` |
| Expected terminal outcomes | DONE = 10 cases merged and gated. BLOCKED = a gate fails for a reason outside this scope. NEEDS_HUMAN = pushing to `origin`, deliberately out of scope |
| Escalation condition | Any need to edit a validator, add a category, or write to `origin`. Main reclaims a slice after two distinct agents fail its packet |
| Resource bounds | Tools: local git, bun, `multi_agent_v1` subagents on `xai/grok-4.6`, `aside` for live citation checks. Write scope: `cases/`, `ontology/concepts/`, `devlog/260911_winhooks/`, `README.md`, `skills/powershell-landmines/`, generated `ontology/graph.json`. No network writes. The user set no token or wall-clock budget and none is invented here |

## Why these, and not the other 24

win-hooks numbers its failures CASE-01..CASE-34. Three groups do not become cases here.

**Its own engine history.** CASE-05, CASE-10, CASE-15, CASE-16, CASE-17, CASE-19,
CASE-21, CASE-30 and CASE-34 describe bugs in win-hooks' own patcher — an `awk` index
replacement that could emit invalid JSON, a `grep -o` that stopped at an escaped quote,
orphaned wrapper files a later design left behind. Real, but the mechanism is that
repository's text-substitution history, not Windows.

**Host policy, not Windows.** CASE-33 (Codex silently skips a hook whose manifest hash
changed), CASE-06, CASE-11, CASE-12, CASE-13, CASE-26 and CASE-32. win-hooks itself rules
that a host's trust policy "is not a Windows defect, so this adds no issue type". We agree.

**Already in the corpus.** CASE-28's note that `codex` on Windows is a `.cmd` shim
`spawnSync` cannot execute is `spawn-npm-enoent-einval` plus `cmd-shim-reparses-argv`.
CASE-08's "a bare binary is not reliably present" is `command-v-noop`. CASE-02's
CRLF-inside-JSON is `split-n-leaves-cr`.

What remained was eleven mechanisms Windows actually owns, each dedupe-checked against
all 98 existing cases by an independent `xai/grok-4.6` explorer before being accepted.
A later adversarial audit sent one of the eleven back to this section: see below.

## Dedupe ledger

Every row was decided by a subagent that ran `bun scripts/fp.mjs search` with several
keyword sets plus `rg` over `cases/`, and reported the closest two existing cases.

| New id | Verdict | Closest existing | Why it is not that case |
|---|---|---|---|
| `ps-quoted-path-is-expression` | NEW | `cmd-shim-reparses-argv` | That is cmd.exe re-tokenizing argv; this is the PowerShell parser refusing to read a quoted path as a command at all |
| `msys-rewrites-slash-args` | NEW | `timeout-is-not-a-command-wrapper` | That is a PATH collision with Git's GNU `timeout`; this is MSYS rewriting `/c` into `C:/` inside argv |
| `cmd-star-ignores-shift` | NEW | `cmd-shim-reparses-argv` | Reparse versus forwarding: no case mentions `%*`, `shift`, or the eight-argument ceiling |
| `cmd-rem-substitutes-parameters` | NEW | `bomless-bat-oem-codepage` | That is how cmd.exe decodes `.bat` bytes; this is substitution inside a line that looks inert |
| `cmd-bom-displaces-label` | OVERLAPS `bomless-bat-oem-codepage` | same BOM, different grammar | That case ends at `'∩╗┐@ECHO' is not recognized`; this one is a dead label and `<< was unexpected at this time`, for which the corpus has zero hits |
| `autocrlf-shebang-cr` | NEW | `split-n-leaves-cr` | Same CRLF residue, different consumer: a POSIX exec layer's interpreter lookup rather than a string split |
| `config-string-eats-windows-path` | NEW | `git-merge-driver-sh-escapes` | That is git's `sh` eating backslashes; this is a config-string escape layer, and it surfaces as `Cannot find module` |
| `caller-picks-interpreter-not-shebang` | NEW | `ps-file-extension-dispatch` | That is PowerShell refusing a non-`.ps1`; this is the wrong interpreter accepting and running the file |
| `bash-on-path-may-be-wsl` | NEW | `timeout-is-not-a-command-wrapper` | Same shape — a stock Windows binary is not the POSIX tool of that name — but a different binary and a different lie: the launcher reports success after failing to open the path |
| `windowsapps-python3-stub-needs-probe` | OVERLAPS `windowsapps-alias-eperm` | same WindowsApps directory | That case's discriminator is the `*/WindowsApps/*` path segment; this case is where that exact heuristic gives a false positive, and only running the binary separates them |

### Dropped after audit: `silent-timeout-kill-seconds-unit`

It survived dedupe and then failed this plan's own scope rule. A hook timeout whose unit
is seconds, and a host that kills a child without reporting it, are both properties of
the *host* — the same class this section already excluded as "host policy, not Windows".
The kill is not silent at the OS level either; the host swallows the status. Two
unrelated defects in one case, neither of them Windows'. Removed rather than argued for.

The OVERLAPS rows ship with a `related_to` edge to the case they neighbour, so the graph
clusters them instead of leaving the relationship in prose. Four ids were renamed after the
audit — `cmd-rem-still-expands`, `json-escapes-windows-path`, `extension-beats-shebang`
and `system32-bash-is-wsl-launcher` — because measurement showed each old name pointed at
the wrong culprit. The dedupe verdicts above are unaffected; only the names changed.

## Contract the new cases must satisfy

Read out of `scripts/lint-cases.mjs` and `scripts/validate-graph.mjs`, not out of README.

- Frontmatter keys `id title category versions failure context source repro refs`, with
  `id` equal to the filename stem and `category` equal to the parent folder.
- `versions` must be a **quoted** string. An unquoted `5.1` is a YAML float and the
  linter rejects it by name.
- The body must contain the exact substrings `## Symptom`, `## Repro`, `## Cause`,
  `## Workaround`.
- Every case here is `source: third-party` and must cite a GitHub `commit` or `pull`
  URL. `repro: historical` unless this checkout actually re-ran the failure.
- `ontology:` is a nested block after `refs`. V7 rejects a case with no `caused_by`,
  V6 rejects a non-`silent` case with no `manifests_as`, and V3 rejects any edge target
  that is not a node — so a new `mechanism-*` needs `ontology/concepts/<id>.md` in the
  same commit.
- A new concept file is `id`, `type`, `label` frontmatter plus a `## Definition` of at
  most 400 characters (V8).
- **One carve-out from "nothing existing is rewritten":** `workaround-skip-windowsapps`
  gains a `## Why it's unsafe` section, because wp4 names it in an `unsafe_fix` edge and
  V9 reads the concept file. It is the round's only edit to an existing concept.

**Resolved during audit.** No case in the corpus uses `related_to` today, so the spelling
was unproven when this plan was written. It is now confirmed from `build-graph.mjs`,
which names case nodes `"case:" + stem` and emits `{from: gid, rel: k, to}` for every
edge key verbatim: `related_to: [case:<stem>]` resolves, and a bare stem would V3-dangle.
The fallback is no longer needed.

## Citations

The win-hooks checkout mined for this round is at
`53584f9685bfe62051a5dd8130875698adceb6ce`. Where a specific commit fixed the failure,
that commit is the citation; otherwise the case cites the `AGENTS.md` permalink at that
SHA, which is where win-hooks writes the mechanism down.

| Evidence | SHA |
|---|---|
| Reject a PATH `bash` that cannot read Windows paths | `006716a3e19e0ddcabf05efae0de151b2c3b1a27` |
| Require the dispatcher to be current, not merely present | `632c5a8b37703599fbe15dbe85d748352b833352` |
| Dispatch every hook through node instead of searching for bash | `0be564a1ed7d8d35e61d31e8b1a5a76d924a33bf` |
| Replace generated wrapper scripts with one descriptor per patched hook | `30cdcb6dc235a7f250f590f2fb6986bb0b2977b9` |
| Bake a resolved Python into Codex python-hook wrappers | `ed2d8e8332ce611ec29e6cc9a3aacd1132efb89e` |
| `WH_BASH_EXE` override and unconditional dispatcher refresh | `e15ac114cc0aae9b5bf0782f2a9b937659226712` |

Each implementation phase confirms its own URLs render before claiming the citation,
using `aside` against the live GitHub pages.

## Work-phase map

Ordered by what each phase produces that the next one consumes, not by effort.

| Phase | Doc | Produces | Consumes |
|---|---|---|---|
| wp1 | this file plus `010`/`020`/`030`/`040` | the locked slate and per-case frontmatter | the dedupe ledger above |
| wp2 | `010_phase1_dispatch_shell.md` | 4 cases, new mechanisms, and the first proof that `related_to` validates | wp1 |
| wp3 | `020_phase2_encoding_parsing.md` | 4 cases and new mechanisms | wp1, wp2's `related_to` verdict |
| wp4 | `030_phase3_env_agent.md` | 2 cases, new mechanisms, resolved citations | wp1, wp2's verdict |
| wp5 | `040_phase4_integration.md` | regenerated graph and skill, corrected counts, merge to `main` | wp2, wp3, wp4 |

wp2 leads the implementation phases because it settles the unproven `related_to`
spelling that every later phase depends on.

## Branch

Implementation commits land on `codex/winhooks-cases`, branched from `main` at
`a96bc28`. wp5 merges it back with `--no-ff` so the round reads as one reviewable unit.
Pushing to `origin` is not in scope.
