# 001 — Classification ledger (100% coverage gate)

Inventory: opencodex 46 + cli-jaw 46 + ima2-gen 10 + codexclaw 1 = 103 commits
(raw_*.txt). Dispositions: per-commit lines live in analyst_opencodex.md (46/46),
analyst_cli-jaw.md (46/46), analyst_ima2-codexclaw.md (11/11 — analyst note: the
ima2 list contained 10 + codexclaw 1). Main-agent verification: analyst outputs
are line-per-sha; spot-checked dispositions during batch implementation (each new
case re-reads its git show before writing).

## Disposition totals

| repo | NEW | REF-APPEND | REJECT |
|---|---|---|---|
| opencodex | 6 | 8 | 32 |
| cli-jaw | 7 | 15 | 24 |
| ima2-gen | 2(1 commit) | (2 folded) | 9 |
| codexclaw | 0 | 0 | 1 |

## New-case queue (15 proposals → dedupe → implement)

opencodex (010/mw2): windowstyle-hidden-vs-windowshide, bun-ps-windowstyle-argv,
english-and-not-separator, join-semicolon-splits-startprocess, ps51-no-and-and,
pwsh-leaks-lastexitcode.
cli-jaw (020/mw3): irm-iex-kills-host, npm-ps1-not-comspec, envpath-pollutes-user,
command-v-noop, ps-file-extension-dispatch, dq-regex-interpolates,
strictmode-missing-property.
ima2-gen (030/mw4): execution-policy-file-block, session-path-stale.

Dedupe notes: windowstyle pair (93a083d1fc CREATE_NO_WINDOW vs 0a90477616 Bun argv)
kept as TWO cases (different mechanism: Win32 console alloc vs Bun spawn bug).
english-and-not-separator vs ps51-no-and-and kept separate (English word vs && token).
Category fix at write time: windowstyle/bun cases are env-paths? No — they are
process-launch semantics; file under args-quoting per analyst, acceptable.

## Ref-append queue

curl-alias += opencodex 760b287bc5. bom-less-ps1-cp949 += opencodex ff6916abcd,
cli-jaw 7f0c655be. native-stderr-errorrecord += cli-jaw 8c72d7568.
ps51-vs-7-split += cli-jaw 322ac1801, 98bd4aa4b, dccabcd05.
oss-native-arg-quoting += cli-jaw 771531124. actions-default-shell += ima2 43a935f9.
exit-code-vs-dollar-q += ima2 1442bd1f. (others fold into their new parent cases)

## SHA verification rule

Every cited SHA: gh api repos/lidge-jun/<repo>/commits/<sha> → 200 = cite full URL,
repro: verified. 404 (dev-only branch) = cite repo-relative path in body prose,
repro: historical, refs keep a reachable blob URL instead.
