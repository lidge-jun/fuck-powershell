# 001 — delivery and measurement

## Delivered

PR #60 merged as `522524a` (merge commit, head `427d15c`). PR-event CI run 35942770705,
attempt 1, 7/7 jobs success; push-event CI and Pages runs on `522524a` success; the
github-pages deployment record is `522524a`; the site answers HTTP 200. mini's clean
clone was fast-forwarded to `522524a`, and its registered command reports
`serverInfo.version` 0.2.0 with the new instructions and descriptions.

## What the model on mini actually sees

The measurement found the real reason for the zero-call runs. Codex on mini runs in
Code Mode: the model's own tool list holds only `functions.exec`, `wait`, the two
question tools, `clock.sleep` and `cua_repl`. MCP tools are deferred inside
`exec` as `ALL_TOOLS` entries named `mcp__fuck_powershell__fp_preflight`,
`..._fp_search`, `..._fp_errors`, `..._fp_case`, and Codex prepends the server's
`instructions` to each of their descriptions. A fresh session asked to quote the
fp_preflight description from its tool list answered "NOT VISIBLE". The descriptions
reach the model only after it looks inside `ALL_TOOLS`, which it has no reason to do.

## fp-trap4 against fp-trap3

Same prompt (sha256 4bae7cb5702b8423, folder name only), same flags, model gpt-6-astra
via opencodex at xhigh, same grader (sha256 b48cb28da8b23c12), no skill installed.

| run | server text | grader | MCP calls | commands | input (cached) | output |
|---|---|---|---|---|---|---|
| fp-trap3 | 0.1.0 | 5/5 | 0 | 42 | 1,504,419 (1,411,968) | 21,926 |
| fp-trap4 | 0.2.0 | 5/5 | 0 | 32 | 991,291 (926,976) | 19,582 |

The assertive text did not change tool use, because the model never saw it. The
token difference is run-to-run variance in how much trial and error the task needed.

## Skill

Reinstalled on mini after fp-trap4 with `bun ~/.fuck-powershell/scripts/install-skill.mjs`:
11 files, `--check` in sync, with the "MCP tools (preferred when registered)" section.
Skills are listed in the model's own context, so the skill is the lever that can send
the model into `ALL_TOOLS`. It does not yet name the Code Mode tool names; that is the
next change worth making, measured by an fp-trap5 run.
