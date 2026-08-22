# 030 — Query skill redesign (ow4)

SKILL.md rewrite: identity = retrieval policy, not knowledge dump.
- Keep compact 10-rule core (fallback when repo not present).
- Add "## Dynamic lookup (preferred)": install = git clone
  https://github.com/lidge-jun/fuck-powershell ~/.fuck-powershell (or any path);
  preflight before patches touching Windows shell risk areas:
  bun ~/.fuck-powershell/scripts/fp.mjs preflight ...; postflight: fp search
  over the diff's risky tokens. PASS/WARN semantics documented.
- references/ stay (generated) for exec-less agents.
- metadata description updated to mention query-first behavior.
