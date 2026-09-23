# 2026-09-23 — OpenCodex Windows landing round

Six confirmed failures from OpenCodex's `windows-latest` jobs are recorded below.
The former Batch-27 TODO is now a case because the resource ownership gaps and
the fix were confirmed.

## Case disposition

| OpenCodex failure | Corpus disposition |
|---|---|
| Mixed-case `ALL_PROXY` / `all_proxy` assignments collapse to one Windows environment variable; the SOCKS-only case sees no SOCKS proxy. | Updated `env-path-vs-PATH-casing`; run 35816090505, PR #5634. |
| SQLite index remains open and temp-home removal returns `EBUSY`; failing test is `tests/claude-integration/claude-native-affinity.test.ts`. | Updated `unlink-while-open-ebusy`; run 35816090505, PR #5634. |
| A fixture simulating Linux/WSL used host `path.join`, producing backslashes that did not match POSIX WSL discovery paths. | Updated `node-path-host-delimiter`; added the distinct `mechanism-host-path-separator`; PR #5634. |
| A service path derived through `os.homedir()` escaped a sandbox whose `HOME` was overridden. | Updated `homedir-escapes-test-sandbox`; run 35816970127, PR #5634. The final fix pins `USERPROFILE` per test on win32, restores it in `finally`, and keeps the original `startsWith` assertion. |
| A stale Aside deadline and socket outlived their test file in a shared `bun test --isolate` batch; observed as a 480-second timeout, then a Bun segmentation fault. | Added `aside-sync-resources-outlive-isolate-file`; failed jobs 107037821321 and 107043425787; green run 35828289232; PR #5634. The green shards were rebalanced, so this was not an exact replay. |
| Ordinary numeric `dev` / `ino` stats rounded distinct Windows file IDs together during a TOCTOU replacement check; `birthtime` can also survive name recreation through NTFS tunneling. | Added `bigint-file-identity-on-windows`; job 107059048170; PR #5656. |

The segmentation fault is recorded as a Bun runtime bug triggered by leaked
handles. No native stack established a deeper crash cause. Unsafe workarounds for
the Aside case—raising the batch timeout, running the file alone, or reordering
files—only hide the shared-process leak.

## Final validation

`bun scripts/lint-cases.mjs` passed (112 cases);
`bun scripts/build-graph.mjs` generated 396 nodes and 826 edges;
`bun scripts/validate-graph.mjs` passed with 0 warnings;
`bun scripts/check-coverage.mjs opencodex 260827_win5repo` passed (341/341);
`bun scripts/build-skill.mjs`, `bun scripts/sync-cases.mjs`, and
`bun scripts/sync-ontology.mjs` completed successfully; docs-site build passed
(120 pages); `git diff --check` passed.
