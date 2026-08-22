# 010 — opencodex batch (mw2): 6 new cases + 2 ref-appends

New: windowstyle-hidden-vs-windowshide (args-quoting, 93a083d1fc),
bun-ps-windowstyle-argv (args-quoting, 0a90477616 + 393d72a779),
english-and-not-separator (args-quoting, a00f1a4618),
join-semicolon-splits-startprocess (args-quoting, ac8c0d2dfd),
ps51-no-and-and (versions, d44e567352),
pwsh-leaks-lastexitcode (exit-codes, d0b5989b79).
Ref-append: curl-alias += 760b287bc5; bom-less-ps1-cp949 += ff6916abcd.
Each case: verify SHA public, git show for exact repro content, write per rev2
schema, lint.
