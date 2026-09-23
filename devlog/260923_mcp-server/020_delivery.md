# 020 — wp3: delivery

Depends on: wp2 commits on local `dev`. Every step below was authorized by the user in
this session ("PR 올리고 배포까지").

1. Pre-push privacy check (DEV-PRIVACY-01) over `git diff origin/main..dev` and
   `git log origin/main..dev`: absolute home paths (`/Users/`, `C:\\Users\\`, `/home/`),
   credential shapes (`ghp_`, `github_pat_`, `sk-[A-Za-z0-9]{20}`, `PRIVATE KEY`,
   `Authorization:`), and the private identifiers this session touched that are not
   part of the public project (the author's private and workplace identifiers, listed
   in the session rather than in this public file; the local
   `.codexclaw/` and `/tmp/` evidence paths). Every hit is reviewed in context: the
   pattern list in this step matches itself and is expected; any other hit that is a real
   path, credential or private identifier is fixed by rewriting the unpushed commits, and
   the reviewed hit list is recorded in the D summary.
2. `git push -u origin dev`.
3. `gh pr create --base main --head dev` with a body file: problem, behavior,
   registration, validation.
4. Hosted CI at the exact head: `gh pr view --json headRefOid`, then
   `gh api repos/lidge-jun/fuck-powershell/commits/<sha>/check-runs` and
   `gh run list --commit <sha>`; all seven jobs (corpus, 4× mcp-node, 2× mcp-bun) must be
   `completed/success` on that SHA. Failures: read the job log, fix on `dev`, push, re-read.
5. Merge with a merge commit so `dev` stays an ancestor of `main`:
   `gh pr merge <n> --merge --match-head-commit <sha>`. Never force-push main.
6. Deploy proof: the `Deploy docs to GitHub Pages` run for the merge SHA
   (`gh run list --workflow deploy.yml --commit <merge sha>`) must conclude success, and
   CI on the merge SHA (push event) is read the same way.
   The deployed commit is read from GitHub's deployment record, which is commit-specific:
   `gh api 'repos/lidge-jun/fuck-powershell/deployments?environment=github-pages&per_page=1'`
   must show `sha == <merge sha>` and its latest status `success` (verified on
   2026-09-23 that this endpoint reports b59324b/success for the current main). Then
   `https://lidge-jun.github.io/fuck-powershell/` and `.../cases/aliases/curl-alias/` must
   answer HTTP 200. This PR does not change site content, so the deployment record, not
   page content, is the proof of which build is live.
7. Local deployment of the server:
   - `git clone https://github.com/lidge-jun/fuck-powershell ~/.fuck-powershell` (clean,
     tracks origin/main; the resolution order in the skill already lists it).
   - Back up `~/.codex/config.toml` to `~/.codex/config.toml.bak-260923-fp-mcp`.
   - `codex mcp add fuck-powershell --env FP_AUTO_UPDATE=1 -- node <abs clone>/scripts/mcp.mjs`,
     then `codex mcp get fuck-powershell` to read back the stored command.
   - Smoke: spawn exactly that command, send legacy `initialize` + `tools/call fp_preflight`
     and a modern `tools/call`, both must return cases. With `FP_UPDATE_INTERVAL_MS=0`
     added to the smoke's environment, poll `fp_search` every second for at most 30 s
     until the header carries `update: up-to-date`; a timeout is a C failure.
8. Local `dev` checkout: fast-forward to the merge commit is not needed (`dev` is the
   merge's parent); report both SHAs.

Rollback: `codex mcp remove fuck-powershell` (only that block; see 021 for why the
backup is never restored wholesale); the merge can be reverted with
`git revert -m 1 <merge sha>` in a new PR.
