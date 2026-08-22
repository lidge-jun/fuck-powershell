# 030 — wp3 ima2-gen

Inventory: inv/win_ima2-gen.txt, 72 SHAs, Tier B grep, prior-round SHAs excluded.

## A different failure surface

ima2-gen is an image-generation CLI and server. It is the only repo in this round
whose Windows pain is mostly about files and processes rather than agent
plumbing: writing binaries, naming outputs, spawning long-lived servers, and
handling temp and cache directories. That makes it the most likely source of
mechanisms the agent-shaped repos cannot produce.

Prior rounds took 10 commits and produced two cases, execution-policy-file-block
and session-path-stale, plus ref appends to actions-default-shell and
exit-code-vs-dollar-q.

## Candidate mechanism families

1. Filename legality. Windows rejects the characters < > : " | ? * and reserves
   CON, PRN, AUX, NUL, COM1-9, LPT1-9 in every directory. A generator that names
   files from prompts or timestamps hits this. The corpus has no case on reserved
   device names, and it is a textbook POSIX-assumption break: opening "nul"
   succeeds and is not a file.
2. Trailing dots and spaces. test-path-trailing-whitespace covers probing; the
   sibling mechanism is that Win32 silently strips a trailing dot or space at
   creation time, so the path you wrote and the path that exists differ. Distinct
   from the Test-Path case if a diff evidences it.
3. Path length. MAX_PATH 260 without the long-path opt-in, and the difference
   between the extended-length prefix working for Win32 API calls and not for
   cmd.exe. Uncovered.
4. Binary mode and stdout. Writing image bytes to stdout through a PowerShell
   pipe corrupts them because the pipeline is text and encodes. Adjacent to the
   encoding cases but genuinely different: those are about text encoding of log
   files, not binary corruption in a pipe.
5. File locking. Windows denies deletion of an open file where POSIX allows
   unlink-while-open. EBUSY or EPERM on cleanup is one of the most common
   cross-platform surprises and the corpus does not have it.
6. Temp directory. TMPDIR versus TEMP versus TMP, and the 8.3 short-name form
   that appears in the TEMP value for some accounts.

## Expected shape

This repo is the best NEW-case candidate of the five. Three to six is plausible.
Every one still has to clear the generalizability bar with a repro that uses
nothing but stock Windows and a mainstream runtime.

## Build steps

Same protocol. Categories most likely used: env-paths, encoding, exit-codes,
streams.

## Acceptance

- 72 of 72 SHAs dispositioned.
- Gate chain green.
- Any binary, locking, or filename mechanism gets a new ontology concept if none
  of the existing 36 fits.

## Disposition table

Filled during B.
