# 022 — wp3 delivery evidence

| Step | Evidence |
|---|---|
| Privacy | Pre-push scan of `origin/main..dev`: only the pattern list in 020 matched. A workplace identifier written into that list was removed by rewriting the unpushed commit (fixup + autosquash) before the first push |
| PR | [#59](https://github.com/lidge-jun/fuck-powershell/pull/59), head `79d678d` |
| PR CI | Run 35842886106, `event=pull_request`, attempt 1, 7/7 jobs success: corpus (112 cases, 396 nodes, 826 edges, 0 warnings); Linux Node 18/22 and Bun 26/26; Windows Node 18/22 and Bun 25 pass + 1 skipped (the dangling-symlink test skips on win32 by design), 0 fail |
| Merge | Merge commit `ea3f00a` (`--merge --match-head-commit 79d678d`), 2026-09-23T09:32:58Z |
| Post-merge CI | Run 35843595097, `event=push` on `ea3f00a`, 7/7 success |
| Pages | Run 35843594980, `event=push` on `ea3f00a`, build + deploy success; github-pages deployment 6610783607 `sha=ea3f00a`, `state=success`; the site root and `/cases/aliases/curl-alias/` answer HTTP 200 |
| Registration | Target host is `mini` (Windows, Codex CLI 0.154.0), not the author's Mac; a first registration on the Mac was removed again (only its block cut out, later user edits kept). On mini: clean clone `%USERPROFILE%\.fuck-powershell` at `ea3f00a`, the existing working checkout `Developers\fuck-powershell` left untouched; exclusive backup `config.toml.bak-260924-fp-mcp`; block appended by hand (`codex mcp add` re-serializes the whole file and drops comments): `command = 'C:\nvm4w\nodejs\node.exe'`, `args = ['%USERPROFILE%\.fuck-powershell\scripts\mcp.mjs']`, env `FP_AUTO_UPDATE=1`. Diff against the backup is that block alone; `codex mcp get --json` reads it back |
| Smoke (mini) | The registered command spawned fresh on win32: legacy `initialize` 2025-06-18 → `fp_preflight` risk high; modern `fp_case curl-alias` `resultType: complete`, Workaround present, 2 refs; `update: up-to-date` after ~1 s with `FP_UPDATE_INTERVAL_MS=0` (stamp written under `%LOCALAPPDATA%\fuck-powershell`); stdout pure JSON-RPC; empty stderr; exit 0 on EOF |

Still unobserved: the handshake Codex itself sends when it starts this server, which
happens at the next session start. The server answers both eras, so either works.

Finding worth keeping: `codex mcp add` re-serializes `~/.codex/config.toml` and drops
comments. Anyone registering by hand should back the file up first or append the block
directly, as done here.

**wp3 D.** Delivered and deployed. No roadmap direction changed in wp3; the one
surprise was the config rewrite above.
