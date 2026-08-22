# 000 — Commit-mining plan (mw1 docs-only cycle)

Goal: 100% disposition of PowerShell-related commits in opencodex(46), cli-jaw(46),
ima2-gen(10), codexclaw(1) → new cases / ref-appends / rejections in fuck-powershell.

Pipeline per repo: raw_<repo>.txt (grep inventory, done) → grok-4.6 read-only analyst
classifies each commit by reading the actual diff (git show) → main agent verifies
dispositions, writes/updates cases → lint + public-SHA verification (gh api
repos/lidge-jun/<repo>/commits/<sha>; miss → repro: historical with repo-relative ref).

Existing 10 cases (dedupe targets): curl-alias, dev-null-redirect,
native-stderr-errorrecord, ps51-vs-7-split, env-domain-principal,
exit-code-vs-dollar-q, oss-native-arg-quoting, oss-outfile-bom, bom-less-ps1-cp949,
actions-default-shell.

Ledger: 001_ledger.md — one row per commit: sha|repo|disposition|target-case|reason.
Batches: 010 opencodex (mw2), 020 cli-jaw (mw3), 030 ima2+codexclaw (mw4), 040 ship (mw5).
