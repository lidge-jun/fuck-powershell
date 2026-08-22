# 010 — Ontology data build (ow2)

1. concepts/: ~40 concept files (Runtime 4, Shell 4, Command ~8, Mechanism ~12,
   ErrorSignature ~10, Workaround ~10, Environment 3, Concept ~6). Template:
   frontmatter {id, type, label} + "## Definition" (<=400 chars) + optional
   "## Why it's unsafe" (unsafe-targeted workarounds only). NO other keys.
2. Extraction: 3 grok-4.6 lanes (18 cases each) read case bodies → propose
   ontology frontmatter blocks + needed concept ids. Main agent normalizes ids,
   dedupes concept list, writes frontmatter into all 54 cases.
3. scripts/build-graph.mjs: parse cases via scripts/lib/frontmatter.mjs (the
   indent-aware nested parser, shared with sync-cases) + concepts → graph.json
   + INDEX.md. scripts/validate-graph.mjs: V1-V9,V11 exit 1 on violation;
   V10 prints WARN lines and never affects exit code.
4. lint-cases.mjs: UNTOUCHED (verified: current line parser skips nested block
   lines harmlessly — audit B3). build-graph.mjs owns the real indent-aware
   nested-FM parser in scripts/lib/frontmatter.mjs, imported by sync-cases for
   chips. Concept files: frontmatter {id, type, label} + "## Definition"
   (+ "## Why it's unsafe" for unsafe-targeted workarounds). NO refs key (B7).
Receipt: validate-graph 0 violations.
5. Scope-widening backlog (Windows-general): re-disposition previously REJECTED
   commits from 260824 sweep that were "windows-but-not-PS-semantics" yet ARE
   generalizable Windows traps: NTFS ADS/trailing-dot (cli-jaw 58aa131b2),
   NTFS case-folding authz (53aaed48c), Windows 8.3 short names/realpath
   (opencodex 4dfc2d69bc), MAX_PATH Run-key (13a76a38a9), SQLite unlink EBUSY
   (5c6be04ef6), Node CVE npm.cmd EINVAL family (b3bd71f24) — candidates for
   new cases in a later work-phase (appended via LOOP-UNIT-CHAIN if time allows,
   else documented backlog).
