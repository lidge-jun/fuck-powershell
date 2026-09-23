# 2026-09-23 — OpenCodex Windows landing round

Four confirmed failures from OpenCodex's `windows-latest` jobs were matched to
existing mechanisms or recorded as a new case. The pending Bun 1.4.0 isolate
failure remains a TODO because its cause is still under investigation.

## Case disposition

| OpenCodex failure | Corpus disposition |
|---|---|
| Mixed-case `ALL_PROXY` / `all_proxy` assignments collapse to one Windows environment variable; the SOCKS-only case sees no SOCKS proxy. | Updated `env-path-vs-PATH-casing`; run 35816090505, PR #5634. |
| Test temp-home removal returns `EBUSY` because the policy path left `routing-history.sqlite` open across cleanup. Repeated on two runs. | Updated `unlink-while-open-ebusy`; run 35816090505, PR #5634. |
| A fixture simulating Linux/WSL used host `path.join`, producing backslashes that did not match POSIX WSL discovery paths. | Updated `node-path-host-delimiter`; PR #5634. |
| A service path derived through `os.homedir()` escaped a sandbox whose `HOME` was overridden. | Added `homedir-escapes-test-sandbox`; run 35816970127, PR #5634. Final fix pins `USERPROFILE` per test on win32 and restores it in `finally`; the original `startsWith` assertion remains unchanged. |

## TODO — Batch-27: Bun 1.4.0 isolate batch

One multi-file `bun test --isolate` batch segfaulted or hung on Windows while
each file passed alone. Root cause is unconfirmed. Do not add a case until the
failure is distinguished from runner/runtime contamination and there is a
reproducible mechanism.

## Follow-up — final service-claim fix

PR #5634 was reviewed and finalized with a test-local `USERPROFILE` override on
win32, restored in `finally`. The test keeps its original `startsWith` assertion.
The alternative that widened acceptance to the shared `HOME/.opencodex` sandbox
and canonicalized paths was rejected because it weakens per-test isolation. The
shared `createTempHome` helper is unchanged because another suite depends on the
shared sandbox. `homedir()` uses `USERPROFILE` on win32, not `HOME`.

Follow-up gates passed: case lint (110); graph build (387 nodes, 811 edges);
graph validation (0 warnings); OpenCodex inventory coverage (341/341); skill
reference and docs synchronization; and `git diff --check`.

## Validation

`check-coverage.mjs opencodex 260827_win5repo` passed for the existing inventory
(341/341). `validate-graph` also exposed a pre-existing missing unsafe-fix
rationale for `workaround-skip-windowsapps`; its definition was completed in the
corpus source and regenerated. The concept data also lacked the matching unsafe
edge already present on `windowsapps-python3-stub-needs-probe`; that source entry
was synchronized so concept generation retains the rationale.

Final gates: `bun scripts/lint-cases.mjs` passed (110 cases);
`bun scripts/build-graph.mjs` generated 385 nodes and 811 edges;
`bun scripts/validate-graph.mjs` passed with 0 warnings;
`bun scripts/check-coverage.mjs opencodex 260827_win5repo` passed (341/341);
`bun scripts/build-skill.mjs`, `bun scripts/sync-cases.mjs`, and
`bun scripts/sync-ontology.mjs` completed successfully. README counts match the
generated graph. `git diff --check` passed.
