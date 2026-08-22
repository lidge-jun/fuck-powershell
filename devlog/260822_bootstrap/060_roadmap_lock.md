# 060 — Roadmap lock (wp1 D artifact)

Written inside wp1 B, closing the docs-only cycle.

## Lock statement

Decade docs 000-050 are final for execution. Mapping to goalplan work-phases:

| work-phase | consumes | deliverable |
|---|---|---|
| wp2 | 010 + 020 | repo skeleton, lint script, 8 seed cases (rev2 schema) |
| wp3 | 030 + 040 | skill folder, Starlight site, Pages workflow |
| wp4 | 050 | gh repo create + push + verify |

## Verification evidence (wp1 C)

- 9/9 cited ref URLs returned HTTP 200 (curl -L, 2026-08-22).
- Two audit rounds: near-pass (URL/wording fixes) then adversarial fail (schema rev2,
  case cut/replace, Starlight frontmatter strip, base path). All blockers folded in.

## Residuals carried to wp2/wp3 P

- Verify skill-installer exact invocation flags before writing README one-liner (wp3).
- sync-cases.mjs must strip custom frontmatter keys and run before astro build in CI.
- First-party blob URLs pinned to main; consider commit-pinned URLs at publish time.
