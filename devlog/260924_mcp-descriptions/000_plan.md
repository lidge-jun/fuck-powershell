# 260924 MCP descriptions — plan (single cycle)

## Summary for a reader who was not here

Three `codex exec` runs on the Windows host mini, with this MCP server registered, made
zero tool calls. On the hardest one (fsync on a reopened file, rename over a file another
process holds, stopping an `npm run serve` grandchild, deleting its cwd) the corpus has an
exact case for every trap, yet the agent found each one by trial and error for 1.5M input
tokens. The only signal a host shows the model is the tool list, and each description was
one soft sentence. The user asked for descriptions that make these tools mandatory for
Windows work. This unit rewrites that text and measures the effect on mini.

## Loop spec

| Field | Value |
|---|---|
| Archetype | satisfy-spec plus one measurement, single PABCD cycle |
| Goal | Assertive tool text shipped to main, running on mini, fp-trap4 measured against fp-trap3 |
| Non-goals | Lookup logic, OPERATION_MAP, cases, CI, the Mac's Codex config |
| Verifier | `node --test tests/*.test.mjs` under node and `FP_MCP_RUNTIME=bun`; PR-event CI run; merge-SHA CI + Pages; mini `tools/list` through the registered command; hidden grader `.grade3.mjs` on fp-trap4; event-log MCP count |
| Stop | wp1 D with c-1..c-4 evidenced |
| Outcomes | DONE; BLOCKED on GitHub or mini access; the fp-trap4 MCP count is a measurement and may be zero |
| Resource bounds | Writes: `scripts/mcp.mjs`, this unit; mini: its clone, `fp-trap4`, the skill directory. User authorized redeploy and reinstall |

## Architect consultation (sol, 01a0d0fc)

| ID | Proposal | Disposition |
|---|---|---|
| D1 | Make lookup a required step for Windows work; route filesystem and process-lifecycle work to fp_search/fp_errors, not to a mismatched preflight operation | Accept |
| D2 | Titles, descriptions, per-property descriptions (soft wording) | Accept titles and property descriptions; **amend** descriptions to imperative REQUIRED/MUST wording per the user's "무조건 써라" |
| D3 | INSTRUCTIONS with the routing rule | Accept routing; amend wording to mandatory |
| D4 | Bump version (proposed 0.1.1) | Amend to 0.2.0: the tool contract text is the change being shipped and the goal names 0.2.0 |
| D5 | Scope every sentence to Windows to limit over-triggering; keep examples short for per-prompt token cost; repeat key instruction in descriptions because hosts may drop `instructions` | Accept |

Reflection (same architect): ALIGNED, with two wording gaps folded: fp_errors lists
cases (the workaround is in fp_case), and the "few hundred bytes" claim was removed
because fp_case with full:true can be longer.

## Diff (scripts/mcp.mjs, text only)

`SERVER_INFO.version`: `"0.1.0"` → `"0.2.0"`.

`INSTRUCTIONS`:

> MANDATORY for any task whose code, script or command will run on Windows or in Windows CI: consult this corpus of reproduced Windows failures BEFORE writing, editing or running that code, and again before you finalize. Use fp_preflight for process spawning, PowerShell/cmd, PATH/env, encodings, redirects, exit codes, argument quoting and installers; for filesystem and process-lifecycle work (fsync, rename/replace, locked or held files, deleting directories, a process's cwd, stopping child processes or process trees, ports) use fp_search with the API and error names; the moment a Windows error appears, call fp_errors with its code before debugging. Read the top cases with fp_case and apply their workarounds. Skipping this has cost past agents long trial-and-error runs on failures already documented here.

| tool | title | description |
|---|---|---|
| fp_preflight | Windows preflight (call first) | REQUIRED before writing, editing or running any code, script or command that will run on Windows or in Windows CI and spawns processes, uses PowerShell or cmd, touches PATH/env, encodings, redirects, exit codes or argument quoting, or installs tools. Returns the reproduced Windows failures for that combination, ranked, with the constraints to follow. Then read the top results with fp_case. Filesystem and process-lifecycle work is not in the operation list: use fp_search for it. |
| fp_search | Search Windows failures | REQUIRED for Windows filesystem and process-lifecycle work, and for any Windows-specific API or command in your plan or diff: search by API, command and error names, e.g. "fsync EPERM", "rename EPERM", "cwd delete EBUSY", "npm spawn". Call it before coding, not after the failure. |
| fp_errors | Explain a Windows error | Call this FIRST whenever an error appears on Windows, before debugging it: pass the error code (eperm, ebusy, enoent, einval, eaddrinuse...) and get the reproduced cases that produce it; then read the relevant ones with fp_case for the workaround. |
| fp_case | Read a Windows failure case | Read a case returned by fp_preflight, fp_search or fp_errors before writing the code it warns about: symptom, cause, the tested workaround and its references. full:true returns the whole case markdown, including the reproduction. |

Property descriptions (inputSchema):

- fp_preflight.runtime: "Runtime that will run the code."
- fp_preflight.operation: "Kind of work. Filesystem and process-lifecycle work is not listed: use fp_search."
- fp_preflight.target: "Command or tool being invoked, e.g. npm, git, curl, python."
- fp_preflight.shell: "Windows PowerShell 5.1 or PowerShell 7, if a PowerShell is involved."
- fp_search.query: "API, command, error or symptom words, e.g. fsync EPERM."
- fp_errors.signature: "Error code, lowercase, with or without the error- prefix, e.g. eperm."
- fp_case.id: "Case id returned by fp_preflight, fp_search or fp_errors."
- fp_case.full: "true returns the whole case markdown, including the reproduction."

`validate()` reads only `type/enum/minLength/maxLength/pattern`; an added `description`
key is ignored by validation, so behavior is unchanged. The existing suite covers
tools/list shape and the main validation error paths. No test asserted description
text, so this unit adds one (see Audit amendments).

## Delivery and measurement

1. Local: node and bun suites; `git diff --check`.
2. Push `dev` (also carries the unpushed 022 evidence commit), PR dev→main, PR-event run
   with 7/7 jobs, merge commit with `--match-head-commit`, merge-SHA CI and Pages push
   runs plus the github-pages deployment SHA.
3. mini: `git -C ~/.fuck-powershell pull --ff-only`; spawn the registered command and
   read `serverInfo.version` and the fp_preflight description from `tools/list`.
4. mini: rerun the fp-trap3 prompt in a new `fp-trap4` folder with identical flags,
   grade with `.grade3.mjs`, count `mcp_tool_call` items and read token usage.
5. mini: reinstall the skill from the updated clone:
   `bun ~/.fuck-powershell/scripts/install-skill.mjs` (copies into `%CODEX_HOME%\skills`
   or `~/.codex/skills`), then `--check`. This happens after step 4 so the measurement
   isolates the descriptions. The moved-aside old copy stays in `.trash-260924`.

## Audit amendments (sol reviewer 01a0d0fe, round 1: GO-WITH-FIXES, 4)

1. Discovery by the measured host: before fp-trap4, a separate fresh codex exec on mini
   asks the model to quote the fp_preflight description and the server's advertised
   version from its own tool list, without calling tools. Each codex exec is a new
   process that starts its own MCP server, so no in-memory tools/list cache survives
   between runs; this probe proves the session-level text rather than assuming it.
2. What is measured: the whole advertised-text change (instructions, titles,
   descriptions, property descriptions, version), not descriptions alone. Baseline held
   fixed and recorded: prompt fp-trap3-prompt.txt sha256 4bae7cb5702b8423 (only the
   folder name changes), flags --skip-git-repo-check --ephemeral
   --dangerously-bypass-approvals-and-sandbox --json, mini config model gpt-6-astra via
   opencodex with model_reasoning_effort xhigh, grader .grade3.mjs sha256
   b48cb28da8b23c12, MCP count = number of "mcp_tool_call" lines in the event log.
3. fp_case text corrected: references are already in the short answer; full:true
   returns the whole markdown including the reproduction.
4. New test in tests/mcp.test.mjs asserting the advertised contract: every tool has a
   title and a description that names Windows; fp_preflight's description starts with
   REQUIRED; fp_search's mentions filesystem and process-lifecycle work; every
   inputSchema property has a non-empty description; initialize and server/discover
   return instructions starting with MANDATORY; serverInfo.version is 0.2.0.
