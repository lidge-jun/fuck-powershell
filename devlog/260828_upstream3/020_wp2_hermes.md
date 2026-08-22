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

## Disposition table

Filled during B.
