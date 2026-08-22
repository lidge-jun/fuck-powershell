# 020 — Windows-commit batch (iw3): dedupe-merged case list

95/95 dispositioned (analyst_*.md). New cases after merging with issue queue:

From commits only (9): pathext-exe-beats-cmd (env-paths, opencodex 1b626e4f81),
env-path-vs-PATH-casing (env-paths, opencodex 371aa579d6),
path-dot-hijacks-bare-npm (env-paths, opencodex 79f923dc5d),
piped-iex-drops-params (args-quoting, cli-jaw 0851921ae),
cmd-posix-env-prefix (ci-agents, cli-jaw 0c20c014e),
cmd-start-ampersand-splits (args-quoting, cli-jaw 0c20c014e),
explorer-exits-one (exit-codes, cli-jaw 0c20c014e),
write-host-not-success-stream (streams, cli-jaw b46261a96),
cmd-shim-reparses-argv (args-quoting, cli-jaw e8c9c53ca + f363a71c0),
path-colon-not-delimiter (env-paths, codexclaw 23e2fee2),
pathext-bare-name-enoent (env-paths, codexclaw b4be8c17) — 11 total.

Merged with issues: spawn-npm-enoent-einval = issue #1 + opencodex 9eaff97974 +
cli-jaw 911b74ad3 (one case, all refs); node-path-host-delimiter = issue #5 +
cli-jaw 80b3d4ab0 (one case).

Ref-appends: bom-less-ps1-cp949 += opencodex 22e156e25a, b63f5c80fa(also ps-file-
extension-dispatch); windowstyle += 26dc5aa2b7; join-semicolon += ebf947ec57;
irm-iex-kills-host += cli-jaw 71dcfdd7a.

Final case count target: 25 + 11 issues + 11 commit-new − 2 merged = 45.
