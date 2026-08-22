# 001 — Research: case inventory + mining strategy

## Audit round 2 corrections (grok fail-verdict, 260822 — all folded in)

- Both source repos are PUBLIC (gh: lidge-jun/cli-jaw PUBLIC, lidge-jun/opencodex
  PUBLIC) → EVERY published case must cite a reachable GitHub blob/commit URL,
  first-party included. Local paths and rollout memory are research pointers only.
- dev-null-redirect: no first-party commit exists in current trees; the case's primary
  evidence is the robodog commit (third-party). First-party memory demoted to anecdote.
- shim-arg-scan: correct devlog is opencodex devlog/_fin/260723_untouched_issue_sweep/
  010_fix_322_shim_bypass.md (NOT 260723_issue_fixes/010). Case reframed: argv scanning
  in a generated pwsh shim + \`*> $null\` vs POSIX redirect; category ci-agents-adjacent
  → filed under streams? No: filed under exit-codes? No — final: category env-paths is
  wrong too; this case is cut from seed v0 (wrapper-generation bug, weak as a PS
  landmine). Replaced by bom-less-ps1-cp949 (stronger, public blob).
- acl-userdomain: reframed as "\$env:USERDOMAIN is not identity" with PS-native repro
  (icacls principal resolution), or cut if reframe reads as product laundry. Decision:
  KEEP reframed — the underlying trap (USERDOMAIN=COMPUTERNAME on workgroup) is generic.
- Schema changes: drop ci-agents category (duplicates context axis) → 7 categories;
  add \`source: first-party|third-party\` and \`repro: verified|historical\`; drop body
  "## Refs" section (frontmatter refs is canonical); versions MUST be quoted strings,
  lint rejects non-string YAML scalars; id must equal filename stem, unique.
- Astro collision: cases/ keeps id/title freely; sync-cases.mjs strips ALL custom keys
  (category/versions/failure/context/source/repro/refs) into a rendered badge table in
  the body and emits only Starlight-legal frontmatter (title, description).
- Starlight base: \`base: '/fuck-powershell/'\` + trailingSlash handling locked in 040.

## First-party cases (evidence pointers, verified 2026-08-22)

| case id | category | evidence |
|---|---|---|
| curl-alias | aliases | cli-jaw a1-system incident: agent ran \`curl\` under PowerShell, resolved to \`Invoke-WebRequest\`, API call failed with misleading error. Memory: rollout 2026-08-11 slack_sender_identity. |
| dev-null-redirect | streams | opencodex PR review: \`> /dev/null\` in a script broke Windows-only CI; removing redirection fixed it. Rollout 2026-07-25. |
| native-stderr-errorrecord | streams | cli-jaw scripts/install.ps1:105 comment — "Windows PowerShell 5.1 turns native stderr into NativeCommandError". First-party mitigation in shipped installer. |
| ps51-installer-contract | versions | cli-jaw windows CI runs both PS7 and 5.1 installer contracts; #Requires -Version 5.1 + NoBootstrap handling (install.ps1:1,36-38). |
| acl-userdomain | env-paths | opencodex devlog 260807/080: USERDOMAIN holds COMPUTERNAME on workgroup machines, icacls principal unresolvable → harden fails closed → 503. Fix: SID principal. |
| shim-arg-scan | args-quoting | opencodex devlog 260723/010: shim checked only $1; global flags before subcommand bypassed internal-command detection (#322). PowerShell/cmd/Unix shims all fixed. |

## Third-party mining (Luna swarm, 3 lanes)

Lanes: aliases / quoting+exit-codes / encoding+streams. Every candidate needs an
open-the-source verification (commit URL reachable, diff actually shows the fix)
before entering cases/. Target: 2+ verified for the seed; the rest logged as leads
for the follow-up mass-mining goal.

## Schema (locked)

\`\`\`yaml
id: curl-alias
title: curl silently becomes Invoke-WebRequest
category: aliases          # aliases|args-quoting|streams|encoding|exit-codes|versions|env-paths|ci-agents
versions: "5.1"            # 5.1|7.x|both
failure: misleading-error  # silent|hard-error|misleading-error
context: [agent, ci]       # interactive|script|ci|agent
refs: []                   # URLs (third-party cases MUST cite commit/PR)
\`\`\`

Body sections: Symptom / Repro / Cause / Workaround / Refs.
Lint: scripts/lint-cases.mjs validates enum fields + required sections, exit 1 on any violation.
