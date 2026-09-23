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
