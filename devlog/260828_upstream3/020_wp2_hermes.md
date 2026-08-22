# 020 — wp2 NousResearch/hermes-agent

Inventory: `inv/t1_hermes-agent.txt` (129 commits), `inv/issues_hermes-agent.txt` (159 open issues).

## Why this one is different

It is Python. Every other repo mined into this corpus has been Node, Bun, Rust,
or TypeScript, so the corpus tells the Node half of several Windows stories and
not the Python half. Those halves are frequently DIFFERENT SENTENCES, which is
what the dedupe bar cares about.

The clearest example already in the corpus: `max-path-260` records that Node maps
`ERROR_FILENAME_EXCED_RANGE` to `ENAMETOOLONG` while Python maps it to `ENOENT`.
Same wall, two different lies, and a Python developer googling "FileNotFoundError"
never finds the Node-shaped case.

## Candidate mechanism families

Hypotheses to test against the diffs and issue bodies, not pre-approved cases:

1. **subprocess argv quoting.** Python builds a command line with its own
   `list2cmdline`, whose rules differ from what Node does and from what
   `CommandLineToArgvW` expects in edge cases. `oss-native-arg-quoting` and
   `shell-true-fallback-injects` own the PowerShell and cmd.exe sides; a Python
   list2cmdline sentence would be new.
2. **Default text encoding.** Before recent versions, `open()` used the locale
   codepage rather than UTF-8, so the same script reads a UTF-8 file as cp949 on a
   Korean machine. `bom-less-ps1-cp949` is the PowerShell version;
   `redirected-ps-output-mojibake` is the pipe version. A Python `open()` default
   is a third distinct reader situation.
3. **stdout encoding.** Printing a non-ASCII character to a legacy console raises
   `UnicodeEncodeError` rather than mangling it — a HARD failure where the
   PowerShell case is silent corruption. Different failure class, likely its own
   case.
4. **Signals.** Windows has no `SIGTERM` semantics; `CTRL_BREAK_EVENT` and
   `CTRL_C_EVENT` exist instead and only reach process groups created with a
   specific flag. `unlink-while-open-ebusy` touches SIGBREAK from the Node side;
   the Python signal model is uncovered.
5. **asyncio event loops.** Proactor versus Selector changes which APIs work, and
   subprocess support differs between them. Uncovered.
6. **venv layout.** `Scripts/` rather than `bin/`, and `python.exe` rather than
   `python`. Adjacent to `pathext-bare-name-enoent` but about a layout convention
   rather than extension resolution.

## Expected shape

The richest of the three. Two to five NEW is realistic, weighted toward encoding
and subprocess. Guard against the opposite failure: a Python-flavored restatement
of a mechanism the corpus already owns is a REF, and "different language" alone is
never the justification for a new case.

## Acceptance

- 129/129 commits and 159/159 issues dispositioned.
- Gate chain green; prior coverage checks unchanged.
- Any encoding case explicitly distinguished from `bom-less-ps1-cp949` and
  `redirected-ps-output-mojibake` in its closing see-also.

## Analyst return

Coverage 129/129 commits and 159/159 issues. The lane proposed 21 candidates,
which is by far the highest of the three and reflects the prediction in this
doc: Python's Windows behavior is the least-covered surface in the corpus. The
main agent re-read the anchors and accepted two, REFed most of the rest into
existing encoding cases, and held several for lack of a distinct sentence.

## Yield

| id | category | mechanism |
|---|---|---|
| python-subprocess-locale-encoding | encoding | text mode decodes a child with the ANSI codepage under strict errors, so one CJK byte raises and stdout comes back empty |
| python-textio-newline-translation | encoding | text-mode WRITE translates newlines, so a pipe injects carriage returns the caller never sent |

## Why so many candidates became REFs

The lane was honest about this in its own confidence section, and it was right to
flag it. `python-utf8-bom-not-sig` (a UTF-8 BOM read as U+FEFF data because the
codec is `utf-8` rather than `utf-8-sig`) and `python-open-utf16le` (a Notepad
UTF-16 file read as UTF-8) are the SAME sentences `utf8-bom-still-breaks-grep`
and `oss-outfile-bom` already carry, met from the reading side rather than the
writing side. A reader who knows "PowerShell writes a BOM and UTF-16 by default"
has what they need; a second case per consuming language would multiply the
corpus by the number of runtimes without adding a mechanism.

The two accepted cases pass that test for the opposite reason. Nothing in the
corpus warned that a PIPE could inject carriage returns, or that `text=True`
picks the ANSI codepage with `errors="strict"` — those are CPython behaviors, not
Windows-writer behaviors, and no PowerShell case implies them.

## Held, with reasons

- `msys-arg-path-conversion` and `msys-posix-drive-path` (Git Bash rewriting
  `/FO` into a path, and `/c/Users` reaching a native binary unconverted) are
  genuinely uncovered and genuinely general. They are held for a dedicated MSYS
  cycle rather than squeezed in here, because the pair needs one case that
  explains both directions of `MSYS_NO_PATHCONV` rather than two half-cases.
- `python-start-new-session-noop`, `job-object-forbids-breakaway` and
  `python-access-xok-pathext` were superseded during this round:
  `kill-hits-one-pid-or-the-whole-tree` (written from openclaw evidence) owns the
  process-group gap, and `pathext-bare-name-enoent` covers the X_OK half.
- `colon-illegal-in-filename`, `junction-resolve-diverges`,
  `win32-stat-zero-inode` and `non-pe-exe-16bit-dialog` are real and uncovered.
  They are recorded here as the next round's candidate list rather than written
  from a single issue body each.

## Commit dispositions (129)

| sha | disposition |
|---|---|
| 9e23ebdd | HELD python-utf8-bom-not-sig |
| c283b164 | REJECT repo-specific |
| 6044e706 | HELD python-utf8-bom-not-sig |
| 2ac58432 | REJECT no-windows-mechanism |
| 4bdddf4e | REJECT docs-only |
| 70598f52 | REJECT repo-specific |
| 341d5aeb | HELD python-open-utf16le (reviewer judged the REF wrong; see 050 held list) |
| dde7075d | HELD python-utf8-bom-not-sig |
| 3af56c22 | REJECT repo-specific |
| 5e8d25d7 | HELD msys-posix-drive-path (see 050 held list) |
| 793f0b3f | REJECT repo-specific |
| f4d3592b | REF pathext-bare-name-enoent |
| a35402ea | REJECT no-windows-mechanism |
| 4a2198bf | REF pathext-bare-name-enoent |
| 1156ba43 | HELD msys-posix-drive-path |
| 10e9da6f | REF bom-less-ps1-cp949 |
| 323df71e | REF cmd-shim-reparses-argv |
| 2cd9e177 | REJECT repo-specific |
| 5b5b5e8d | NEW python-subprocess-locale-encoding |
| 9dcce84c | REF redirected-ps-output-mojibake |
| 9e6cfcda | HELD python-utf8-bom-not-sig |
| 3fee5c29 | REJECT test-only |
| f2feb6f3 | HELD python-utf8-bom-not-sig |
| ece678db | HELD python-utf8-bom-not-sig |
| b76498ba | HELD python-utf8-bom-not-sig |
| aa1fac98 | HELD python-utf8-bom-not-sig (reviewer judged the REF wrong; see 050 held list) |
| a024ccd6 | REJECT test-only |
| 022d196f | REJECT no-windows-mechanism |
| 36f73df1 | HELD python-utf8-bom-not-sig |
| 0c2cdccc | REJECT repo-specific |
| 55e70f57 | REJECT test-only |
| dae7e547 | REJECT test-only |
| eb78ab23 | HELD python-utf8-bom-not-sig |
| 696fae8e | HELD python-utf8-bom-not-sig |
| 62f00319 | REF split-n-leaves-cr |
| e65ff962 | REF lf-pure-transform-mixes-eol |
| c892ca25 | REF pathext-bare-name-enoent |
| 1398cc40 | REF bom-less-ps1-cp949 |
| 0a6fda01 | HELD python-utf8-bom-not-sig |
| 5c5960d9 | REF windowstyle-hidden-vs-windowshide |
| 6c2c866a | REF node-path-host-delimiter |
| b14be881 | REJECT repo-specific |
| 0b40ba10 | REJECT refactor |
| bc6839aa | REF lf-pure-transform-mixes-eol |
| 73b3a8af | REF utf8-bom-still-breaks-grep |
| acee4f25 | REF redirected-ps-output-mojibake |
| 7d597cc5 | HELD python-open-utf16le |
| 97249cfc | REF bom-less-ps1-cp949 |
| edfa4cd9 | HELD python-utf8-bom-not-sig |
| f3612328 | HELD python-utf8-bom-not-sig |
| 51e1fb8f | HELD python-utf8-bom-not-sig |
| fb0217c6 | REJECT no-windows-mechanism |
| 780e0980 | HELD python-utf8-bom-not-sig |
| a4ecb3da | HELD python-utf8-bom-not-sig |
| 7886c5d6 | REJECT repo-specific |
| 651bd989 | REJECT no-windows-mechanism |
| f0d22e4b | REJECT test-only |
| 3f8b2200 | HELD msys-posix-drive-path |
| 8ff162fb | REJECT test-only |
| 1deeaf71 | REJECT no-windows-mechanism |
| 87be36c2 | REJECT no-windows-mechanism |
| 713236dc | REF split-n-leaves-cr |
| a2d49de8 | HELD msys-arg-path-conversion |
| 51c01062 | REJECT test-only |
| 71418353 | REJECT test-only |
| cc2abd57 | HELD msys-arg-path-conversion (see 050 held list) |
| b7c4369c | REJECT no-windows-mechanism |
| aa2aac68 | REF zip-entry-drive-letter-escapes |
| e74033b3 | HELD ps-provider-8-3-tilde (see 050 held list) |
| 67316fdc | REF native-stderr-errorrecord |
| 899acfe4 | REF session-path-stale |
| 71418353 | REJECT test-only |
| 182092c5 | REJECT no-windows-mechanism |
| 214b7e07 | REJECT repo-specific |
| 5f84c914 | HELD python-utf8-bom-not-sig |
| 296fcdfa | REF spawn-npm-enoent-einval |
| 8836b3a1 | REF pathext-bare-name-enoent |
| 6312dd8c | REF pathext-bare-name-enoent |
| a4cfc8b7 | REJECT repo-specific |
| 3b29e65c | REJECT repo-specific |
| e2d69ce0 | REJECT repo-specific |
| 17edb1db | REJECT repo-specific |
| d5fe4672 | REJECT repo-specific |
| c7e46f9f | REJECT repo-specific |
| 80d782bc | REJECT repo-specific |
| 6bd0be30 | REF lf-pure-transform-mixes-eol |
| b183be95 | REF unlink-while-open-ebusy |
| 60bb98e0 | REJECT repo-specific |
| 5dcfb0b8 | REJECT repo-specific |
| da3bd34c | REJECT repo-specific |
| a53e8ca7 | REF utf8-bom-still-breaks-grep |
| 4b30db1f | REF utf8-bom-still-breaks-grep |
| e3a254d6 | REJECT repo-specific |
| 705eaa05 | REJECT repo-specific |
| fb138d91 | REJECT repo-specific |
| 3925be27 | REF bom-less-ps1-cp949 |
| c0b64f08 | REJECT repo-specific |
| e5f19af2 | REJECT repo-specific |
| 622c27e5 | REF windowsapps-alias-eperm |
| 524490a4 | REJECT repo-specific |
| c8c8c53a | REJECT repo-specific |
| 61fb5a48 | REJECT refactor |
| 121bbe03 | REJECT test-only |
| c0da5d09 | REJECT no-windows-mechanism |
| 59fbcd5c | REF utf8-bom-still-breaks-grep |
| 0548facc | REJECT repo-specific |
| 52e497ce | REF utf8-bom-still-breaks-grep |
| a2efad6b | REF pathext-bare-name-enoent |
| 8f91d7bf | NEW python-textio-newline-translation |
| d52e5417 | REJECT repo-specific |
| c469a05c | REJECT repo-specific |
| e93bfc6c | REF kill-hits-one-pid-or-the-whole-tree |
| b7fe7ed7 | REJECT repo-specific |
| a6168c2a | REF utf8-bom-still-breaks-grep |
| b2bdf274 | REJECT repo-specific |
| 87fca834 | REF utf8-bom-still-breaks-grep |
| ec1714e7 | REF native-stderr-errorrecord |
| f0d2516a | REF npm-ps1-not-comspec |
| 2c7b479d | REF python-textio-newline-translation |
| 225b57f3 | REJECT repo-specific |
| 4d7e72e1 | REJECT repo-specific |
| eeb723ff | REF kill-hits-one-pid-or-the-whole-tree |
| 5486ad2f | REJECT repo-specific |
| 4689ace7 | REJECT docs-only |
| 9e992df8 | REJECT no-windows-mechanism |
| 45735e71 | REJECT no-windows-mechanism |
| 43b3a0ac | REJECT no-windows-mechanism |
| 453e0677 | REF path-colon-not-delimiter |
| 354af6cc | REJECT refactor |
| ddae1aa2 | REF irm-iex-kills-host |

## Open-issue dispositions (159)

| issue | disposition |
|---|---|
| #36929 | REJECT no-windows-mechanism |
| #87828 | REJECT repo-specific |
| #63783 | REJECT no-windows-mechanism |
| #89442 | NEW python-subprocess-locale-encoding |
| #91479 | REJECT repo-specific |
| #84437 | REJECT no-windows-mechanism |
| #85384 | REJECT repo-specific |
| #83592 | REJECT no-windows-mechanism |
| #87703 | REJECT repo-specific |
| #89857 | HELD constrained-language (see 050 held list) |
| #85278 | REJECT repo-specific |
| #82624 | REJECT repo-specific |
| #84678 | REJECT repo-specific |
| #27666 | REJECT repo-specific |
| #69916 | REF kill-hits-one-pid-or-the-whole-tree |
| #87419 | REJECT security-unrelated |
| #75791 | HELD cmdline-includes-exe-suffix |
| #82842 | REJECT security-unrelated |
| #43238 | REJECT no-windows-mechanism |
| #70619 | REJECT repo-specific |
| #67637 | REJECT repo-specific |
| #65439 | REJECT security-unrelated |
| #87542 | HELD msys-arg-path-conversion (see 050 held list) |
| #85659 | REJECT no-windows-mechanism |
| #44567 | REJECT repo-specific |
| #86204 | REF kill-hits-one-pid-or-the-whole-tree |
| #83459 | REJECT no-windows-mechanism |
| #74074 | REF pathext-bare-name-enoent |
| #15828 | REJECT no-windows-mechanism |
| #87761 | REF unlink-while-open-ebusy |
| #58275 | REF kill-hits-one-pid-or-the-whole-tree |
| #55646 | REF known-folder-empty-not-error |
| #21732 | REJECT no-windows-mechanism |
| #38617 | REJECT repo-specific |
| #80184 | REJECT repo-specific |
| #84615 | REJECT repo-specific |
| #46199 | REJECT no-windows-mechanism |
| #90471 | REJECT repo-specific |
| #73163 | REJECT repo-specific |
| #60132 | REF native-stderr-errorrecord |
| #87092 | REJECT no-windows-mechanism |
| #85132 | REF python-subprocess-locale-encoding |
| #71890 | REJECT repo-specific |
| #86571 | REJECT repo-specific |
| #67185 | REJECT no-windows-mechanism |
| #77813 | REJECT no-windows-mechanism |
| #78383 | REJECT repo-specific |
| #85406 | REF node-path-host-delimiter |
| #40138 | REF zip-entry-drive-letter-escapes |
| #91942 | REJECT no-windows-mechanism |
| #71995 | REJECT repo-specific |
| #70779 | HELD ps-provider-8-3-tilde |
| #90727 | REJECT repo-specific |
| #47767 | HELD msys-posix-drive-path |
| #79474 | REJECT no-windows-mechanism |
| #87156 | REJECT repo-specific |
| #82443 | HELD bash-eats-windows-backslash (see 050 held list) |
| #80946 | REF dynamic-import-needs-file-url |
| #92225 | REJECT repo-specific |
| #85787 | HELD junction-resolve-diverges (see 050 held list) |
| #13261 | REF zip-entry-drive-letter-escapes |
| #76267 | REJECT repo-specific |
| #88810 | REJECT no-windows-mechanism |
| #76246 | REJECT repo-specific |
| #43073 | HELD bash-eats-windows-backslash |
| #49500 | REJECT repo-specific |
| #92271 | HELD colon-illegal-in-filename (see 050 held list) |
| #80227 | REJECT repo-specific |
| #82572 | REJECT no-windows-mechanism |
| #79827 | REF windowstyle-hidden-vs-windowshide |
| #89597 | REJECT repo-specific |
| #80114 | REJECT repo-specific |
| #84694 | REJECT repo-specific |
| #26041 | HELD msys-posix-drive-path |
| #77466 | REJECT security-unrelated |
| #57247 | REJECT no-windows-mechanism |
| #77462 | HELD python-chmod-not-acl (see 050 held list) |
| #85159 | REJECT no-windows-mechanism |
| #61568 | REF zip-entry-drive-letter-escapes |
| #83851 | NEW python-subprocess-locale-encoding |
| #87152 | REF python-subprocess-locale-encoding |
| #45931 | REF python-subprocess-locale-encoding |
| #83767 | NEW python-subprocess-locale-encoding |
| #86704 | REJECT repo-specific |
| #89878 | REF python-subprocess-locale-encoding |
| #52244 | REF python-subprocess-locale-encoding |
| #87889 | REF unlink-while-open-ebusy |
| #60243 | REJECT test-only |
| #85639 | REJECT repo-specific |
| #83938 | REJECT test-only |
| #59556 | REJECT no-windows-mechanism |
| #60384 | REJECT repo-specific |
| #84206 | REF python-subprocess-locale-encoding |
| #60129 | REF native-stderr-errorrecord |
| #73355 | REJECT repo-specific |
| #54927 | REF localized-cli-output-parsing |
| #84361 | REJECT repo-specific |
| #76965 | REF max-path-260 |
| #82184 | REJECT repo-specific |
| #86107 | REJECT repo-specific |
| #58825 | REF split-n-leaves-cr |
| #73296 | REJECT no-windows-mechanism |
| #53367 | REF python-subprocess-locale-encoding |
| #85986 | REF python-subprocess-locale-encoding |
| #85265 | REF kill-hits-one-pid-or-the-whole-tree |
| #63717 | REJECT repo-specific |
| #76259 | HELD non-pe-exe-16bit-dialog (see 050 held list) |
| #8120 | REJECT repo-specific |
| #87609 | REJECT no-windows-mechanism |
| #89659 | REJECT repo-specific |
| #77051 | REF get-command-where-disagree |
| #88945 | REF windowstyle-hidden-vs-windowshide |
| #86579 | REJECT repo-specific |
| #87833 | REJECT repo-specific |
| #86166 | HELD colon-illegal-in-filename |
| #91675 | REJECT repo-specific |
| #62429 | REJECT no-windows-mechanism |
| #69907 | REJECT repo-specific |
| #81535 | REJECT repo-specific |
| #76129 | REJECT repo-specific |
| #51215 | REF kill-hits-one-pid-or-the-whole-tree |
| #90812 | REJECT repo-specific |
| #77488 | REJECT repo-specific |
| #91097 | REJECT repo-specific |
| #83583 | REJECT repo-specific |
| #84527 | REJECT repo-specific |
| #78820 | REJECT repo-specific |
| #68128 | REF kill-hits-one-pid-or-the-whole-tree |
| #89756 | REJECT repo-specific |
| #89697 | REJECT no-windows-mechanism |
| #89615 | REJECT no-windows-mechanism |
| #74064 | REF shell-true-fallback-injects |
| #80952 | REJECT repo-specific |
| #51715 | HELD venv-scripts-not-bin (see 050 held list) |
| #84456 | REJECT no-windows-mechanism |
| #73299 | REJECT repo-specific |
| #69033 | REF kill-hits-one-pid-or-the-whole-tree |
| #61557 | REJECT repo-specific |
| #92091 | REJECT no-windows-mechanism |
| #72070 | REJECT no-windows-mechanism |
| #86911 | HELD cmdline-includes-exe-suffix (see 050 held list) |
| #31485 | REJECT no-windows-mechanism |
| #48986 | REJECT test-only |
| #88264 | REF lf-pure-transform-mixes-eol |
| #60244 | REF piped-iex-drops-params |
| #68058 | REF lf-pure-transform-mixes-eol |
| #88274 | REJECT repo-specific |
| #75175 | REF lf-pure-transform-mixes-eol |
| #49582 | REJECT no-windows-mechanism |
| #81787 | REJECT no-windows-mechanism |
| #81788 | REJECT no-windows-mechanism |
| #65924 | REJECT no-windows-mechanism |
| #83586 | REJECT security-unrelated |
| #77429 | REJECT no-windows-mechanism |
| #82344 | REJECT security-unrelated |
| #57788 | REJECT repo-specific |
| #31417 | REJECT no-windows-mechanism |
| #82986 | REJECT no-windows-mechanism |
| #79381 | REJECT no-windows-mechanism |
