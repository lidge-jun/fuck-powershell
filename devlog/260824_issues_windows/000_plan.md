# 000 — Issues + Windows-commit mining plan (iw1 docs-only)

## Issue disposition plan (11 open, all schema-formatted submissions by lidge-jun)

| # | proposed id | category | disposition |
|---|---|---|---|
| 1 | spawn-npm-enoent-einval | aliases | NEW (Node spawn: bare npm ENOENT vs npm.cmd EINVAL post-CVE-2024-27980; distinct from npm-ps1-not-comspec which is shim SELECTION) |
| 2 | windowsapps-alias-eperm | env-paths | NEW (WindowsApps zero-byte appExecLink passes probes, spawns EPERM) |
| 3 | tee-object-utf16 | encoding | NEW (Tee-Object UTF-16 default; sibling of oss-outfile-bom but different cmdlet + double-grep failure) |
| 4 | prose-as-unknown-flags | args-quoting | NEW (diagnostic-pattern case: CLI blaming prose = PS shredded the arg; complements oss-native-arg-quoting with the SYMPTOM entry point) |
| 5 | node-path-host-delimiter | env-paths | NEW (node:path delimiter follows host — cross-platform test trap) |
| 6 | backslash-quote-ends-span | args-quoting | NEW (\" ends quoted span in native arg passing — one JSON arg becomes several) |
| 7 | utf8-bom-still-breaks-grep | encoding | NEW (5.1 -Encoding utf8 writes BOM; utf8NoBOM param missing — extends oss-outfile-bom's workaround with its own failure) |
| 8 | out-string-multiplies-stderr | streams | NEW (Out-String wraps ErrorRecord rendering: 1 stderr line → 8 lines incl script text injection) |
| 9 | get-command-where-disagree | aliases | NEW (Get-Command vs where.exe resolution disagreement; complements npm-ps1-not-comspec) |
| 10 | dollar-backslash-vars | args-quoting | NEW ($\ etc parse as variable names; sed backrefs/price ranges deleted) |
| 11 | if-nativecmd-truthiness | exit-codes | NEW (if(native) branches on OUTPUT PRESENCE not exit; issue itself cites relationship to exit-code-vs-dollar-q as sibling, not dup) |

All 11 are NEW: each names a distinct mechanism not covered by the 25 existing
cases. Verified by title+body scan against existing ids. Bodies are already in
Symptom/Repro/Cause/Workaround form — conversion is mostly frontmatter wrapping
+ body normalization (strip metadata header line, keep sections, ensure no
"## Refs" section per rev2; refs go in frontmatter — issues carry no URLs, so
refs = the issue URL itself as evidence trail).

## Windows-commit mining

Filtered inventories (fix-grep + shell-semantic paths, minus 103 dispositioned):
win_opencodex.txt 62, win_cli-jaw.txt 19, win_codexclaw.txt 14 = 95. Three
grok-4.6 analysts dispatched with STRICT generalizability bar. Coverage gate
same as mw1 (every sha in analyst output).

## Batches

010 issues (iw2), 020 windows commits (iw3), 030 ship+close (iw4).
