# 021 — wp3 revalidation of 020 (delivery)

wp2 D direction carried forward: "Next: wp3 delivery per 020." Unchanged.

Current facts (2026-09-23): `dev` = origin/main b59324b + 11 commits, 0 behind. The
privacy check in 020 step 1 was run before pushing: every hit reviewed in context. The
only real finding, workplace identifiers written into 020's own pattern list, was
removed by rewriting the unpushed commit that introduced it (fixup + autosquash onto
b59324b); devlog SHAs were then updated to the rewritten history (2fbf7f1).

Expected hosted evidence at the PR head: workflow `CI` (pull_request event) with
7 jobs, `corpus`, `mcp-node (ubuntu-latest, 18)`, `mcp-node (ubuntu-latest, 22)`,
`mcp-node (windows-latest, 18)`, `mcp-node (windows-latest, 22)`,
`mcp-bun (ubuntu-latest)`, `mcp-bun (windows-latest)`, all completed/success on the
head SHA. `deploy.yml` does not run on pull requests. After merge: `CI` (push event)
and `Deploy docs to GitHub Pages` on the merge SHA, then the github-pages deployment
record (sha == merge SHA, status success) and two HTTP 200 checks.

PR body (file, passed with `--body-file`): problem and behavior (agents query the
corpus as MCP tools; answers follow the checkout; opt-in ff-only auto-update), protocol
support (2026-07-28 + legacy initialize), the tie-order behavior change with its
example, registration commands, validation (local node/bun 26/26, parity 126/0, CI).

Local registration (020 step 7) is unchanged: clean clone at `~/.fuck-powershell`
from origin after the merge, config backup, `codex mcp add ... --env FP_AUTO_UPDATE=1`,
`codex mcp get`, then a smoke through that exact command with a 30 s bounded poll for
`update: up-to-date`.

Failure handling: a failing CI job is read from its job log at the exact head; a fix is
a new commit on `dev` (no force-push once pushed); CI is re-read at the new head.

## Architect reflection amendments

- CI runs on both `push` to `dev` and `pull_request`. PR validation is the run with
  `event == "pull_request"` whose `headSha` equals the PR head: record its run id,
  attempt and all seven jobs from `gh run view <id> --json event,headSha,attempt,jobs`.
  The push-event run on the same SHA is recorded separately and never substitutes.
- Deploy proof uses the `Deploy docs to GitHub Pages` run with `event == "push"` and
  `headSha == <merge sha>` (the workflow also allows manual dispatch), then the
  github-pages deployment record for that SHA.
- Registration preflight (checked 2026-09-23 before any change): `~/.fuck-powershell`
  absent, no `fuck-powershell` MCP entry, no backup file at the chosen name. If any of
  these exists at step time, stop and report instead of overwriting.
- Rollback removes only this registration: `codex mcp remove fuck-powershell`. The
  config backup is a last resort for a corrupted file, compared by diff before any
  restore so later unrelated changes are not lost.
