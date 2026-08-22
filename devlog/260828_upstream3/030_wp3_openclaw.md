# 030 — wp3 openclaw/openclaw

Inventory: `inv/t1_openclaw.txt` (232 commits), `inv/issues_openclaw.txt` (105 open issues).

## Scale and method

232 commits out of an 81,534-commit history, all matching the narrow Tier-1
mechanism grep. This is the largest per-repo commit inventory of any round so far,
and it runs LAST so it meets the largest corpus.

**Deduplicate by patch-id before sampling anything.** The previous round learned
this the expensive way: 44 rows that looked like 44 judgments were 7 unique
patches re-landed across branches, and a sample of ten was mostly re-reading
duplicates. `git patch-id --stable` first, then read one representative per
unique patch.

## Surface

openclaw is a TypeScript agent runtime with heavy real-world Windows usage. Its
uncovered surfaces are the ones a long-running desktop agent has and a CLI does
not:

1. **Named pipes versus unix domain sockets.** Windows IPC is `\\\\.\\pipe\\name`,
   with different lifetime, permission, and path rules than a socket file. The
   corpus has nothing on this, and it is a strong POSIX-assumption break: there is
   no file on disk to `unlink`, and the "address" is a namespace entry.
2. **File watching.** No inotify. `ReadDirectoryChangesW` has different event
   coalescing, misses events under load, and reports directory-level rather than
   file-level changes in some modes. Uncovered, and a classic source of
   works-on-my-machine bugs.
3. **Console and VT mode.** Virtual terminal sequences must be explicitly enabled
   via `ENABLE_VIRTUAL_TERMINAL_PROCESSING`, and conhost behaves differently from
   Windows Terminal. `windowstyle-hidden-vs-windowshide` owns window creation
   flags; VT mode is a different sentence.
4. **Process trees.** Already partly owned by `unlink-while-open-ebusy` (no POSIX
   process groups, taskkill /T). A new case needs something beyond that.
5. **Installer and updater paths.** Replacing a running executable is impossible
   on Windows in the POSIX sense — the file is locked while it runs.
   `atomic-rename-loses-to-scanner` owns the transient-holder version; a
   self-replacement case would be about a permanent one.

## Expected shape

Two to five NEW. The named-pipe and file-watching families are the most likely,
because they are surfaces a desktop agent exercises constantly and none of the
five first-party repos did.

## Acceptance

- 232/232 commits and 105/105 issues dispositioned, with the patch-id collapse
  recorded so the reading effort is auditable.
- Gate chain green; prior coverage checks unchanged.
- Any process-tree or file-lock proposal explicitly distinguished from
  `unlink-while-open-ebusy` and `atomic-rename-loses-to-scanner`.

## Disposition table

Filled during B.
