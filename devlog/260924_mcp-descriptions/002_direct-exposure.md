# 002 — direct exposure in Code Mode

## Cause (read through Aside against the Codex docs and openai/codex @ f5f08c5)

- Codex picks the tool mode from the model entry before the feature flags
  (`requested_tool_mode`: `model_info.tool_mode` first, then `CodeModeOnly`/`CodeMode`
  features). OpenCodex's model catalogs set `tool_mode = "code_mode_only"` by default
  (`codexToolMode`), so mini runs in Code Mode although `features.code_mode` is off.
- In that mode MCP tools are exposed only inside `exec` (`ALL_TOOLS`), and the model
  never reads their descriptions.
- `features.code_mode.direct_only_tool_namespaces` removes the DEFERRED and CODE_MODE
  exposure for the listed namespaces and makes their tools top-level
  (`core/src/tools/spec_plan.rs`). The MCP namespace is `mcp__<server>` with `-` → `_`
  (Codex's own test uses `mcp__rmcp` for server `rmcp`).

## Applied on mini

Exclusive backup `config.toml.bak-260924-fp-direct`, then appended:

```toml
[features.code_mode]
direct_only_tool_namespaces = ["mcp__fuck_powershell"]
```

Diff against the backup is those lines alone. A fresh `codex exec` asked to quote the
descriptions from its own tool list, without calling tools, now quotes them verbatim;
before the change it answered "NOT VISIBLE".

## fp-trap5

Same prompt (folder name only), flags, model and grader as fp-trap3/4. Differences from
fp-trap4: direct exposure on, and the reinstalled skill present.

| run | exposure | skill | grader | MCP calls | shell commands (failed) | file edits | uncached input | output |
|---|---|---|---|---|---|---|---|---|
| fp-trap3 | hidden | none | 5/5 | 0 | 21 (2) | 6 | 92,451 | 21,926 |
| fp-trap4 | hidden | none | 5/5 | 0 | 16 (0) | 5 | 64,315 | 19,582 |
| fp-trap5 | direct | new | 5/5 | 16 | 9 (1) | 3 | 109,610 | 20,748 |

The model called fp_preflight and fp_search first, read seven cases (among them
fsync-readonly-handle-eperm, atomic-rename-loses-to-scanner, cwd-locked-cannot-unlink,
unlink-while-open-ebusy), wrote the code, and passed its own tests on the first run; it
went back to fp_errors (eperm, ebusy) and one more case while strengthening the tests.
The number of shell commands halved and no exploratory probe scripts were needed.
Total tokens did not drop: the case text is read into context, so uncached input rose.
What changed is the path to the answer, taken from the corpus instead of from trial and
error. One run per configuration; the counts carry run-to-run variance.
