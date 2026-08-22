# 050 — Publish (wp4)

1. git init (repo root fuck-powershell), branch main, [agent] commits.
2. gh repo create lidge-jun/fuck-powershell --public --source . --push
   (name policy risk: if GitHub rejects the name → NEEDS_HUMAN; do not rename silently).
3. Verify: gh repo view lidge-jun/fuck-powershell --json url,visibility; git rev-parse HEAD
   vs remote SHA.
4. Pages: gh api repos/lidge-jun/fuck-powershell/pages -X POST with build_type=workflow
   (if 403/422, leave documented in README and report — workflow will still deploy once
   Pages source is set to GitHub Actions).
5. Description: "PowerShell landmine archive: reproducible cases where POSIX assumptions
   explode. With an installable agent skill + docs site." Topics: powershell, windows,
   gotchas, cross-platform, agent-skills.

Note: this is a NEW standalone repo, not a submodule registration in parent \`new\` repo —
parent repo remains untouched (out of scope). Submodule wiring can be a follow-up.
