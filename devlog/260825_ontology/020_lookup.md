# 020 — Lookup engine (ow3)

scripts/fp.mjs (bun, no deps):
- fp search <text> — token match over case titles/ids/error labels; returns
  ranked case ids + files.
- fp preflight --platform win32 --runtime node|bun|powershell|cmd
  --operation <enum> [--target <name>] [--shell 5.1|7] [--json].
  OPERATION ENUM (locked flag→node map, no embeddings):
    spawn      → mechanism-pathext-resolution, mechanism-cmd-reparse, command-<target>
    env-path   → mechanism-registry-env-snapshot, concept-path-resolution
    encoding   → mechanism-bom-sniffing, mechanism-default-encoding
    redirect   → mechanism-stream-wrapping
    exit-code  → mechanism-exit-code-propagation
    quoting    → mechanism-native-argv-rebuild
    install    → concept-execution-policy, mechanism-registry-env-snapshot
    ci         → env-actions-runner
  --target maps to command-<target> when the concept exists (else token match).
  --runtime maps: node→runtime-node, bun→runtime-bun, powershell→shell-powershell-51
  (with --shell 7 → shell-pwsh-7), cmd→shell-cmd. --platform win32→env-windows
  (default; the corpus IS windows — flag kept for interface stability).
  Traversal: score = |case edges ∩ query nodes| weighted (invokes 3, caused_by 2,
  affects 1); multi-hit (e.g. 3 npm cases) is the CORRECT ranked return.
  Output {risk: high|medium(score thresholds), cases:[{id,score,reason[]}],
  constraints[]} (constraints = mitigated_by labels of top-3).
- fp case <id> — prints the case file path + body.
- fp errors <signature> — reverse index lookup (error-einval → cases).
Scenarios (receipts): npm spawn → spawn-npm-enoent-einval top; PATH edit
(--operation env-path) → envpath-pollutes-user/session-path-stale/path-colon;
Out-File encoding → oss-outfile-bom/utf8-bom-still-breaks-grep/tee-object-utf16.
