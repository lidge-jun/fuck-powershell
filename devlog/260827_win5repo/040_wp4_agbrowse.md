# 040 — wp4 agbrowse

Inventory: inv/win_agbrowse.txt, 18 SHAs, Tier B grep. Never mined before — no
agbrowse SHA appears in either prior round.

## Why it runs fourth

Unknown yield. Running it after three calibrated repos means the dedupe bar is
already exercised and the corpus is at its largest, so a NEW case out of agbrowse
has to survive comparison with everything the other repos contributed.

## Surface

agbrowse drives Chrome over CDP and automates AI web UIs. Its Windows-relevant
surfaces:

1. Browser executable discovery. Finding chrome.exe across Program Files,
   Program Files (x86), and LOCALAPPDATA, plus the registry App Paths key. The
   space in Program Files is the classic quoting trap and oss-native-arg-quoting
   may already own it; the registry lookup does not exist in the corpus.
2. User-data-dir and profile locking. Chrome holds a lock on its profile
   directory, and on Windows that lock is mandatory rather than advisory, so a
   stale process blocks a new launch in a way it would not on Linux. Same
   file-locking family flagged in wp3, and the two must not become duplicate
   cases: whichever repo evidences it first owns the case, the other appends a
   ref.
3. Zip-entry path traversal. One commit rejects .. segments and Windows drive
   letters in zip entry names. The Windows half is real: an entry named C:evil or
   a backslash-separated traversal is normalized differently by Win32 than by
   POSIX. mechanism-win32-path-normalization already exists as a concept, so
   check whether an existing case owns it before proposing NEW.
4. Process termination. Killing a browser tree. taskkill /T versus process.kill,
   and the fact that Windows has no process groups in the POSIX sense so a naive
   kill orphans children. The corpus has no case on this and it is a strong
   POSIX-assumption break.

## Expected shape

Zero to two NEW. With 18 rows and a young history, NOOP is a live possibility and
is a correct result if the diffs are browser plumbing rather than platform
semantics.

## Acceptance

- 18 of 18 SHAs dispositioned.
- Gate chain green.
- Any overlap with the wp3 locking mechanism resolved as REF, not a second case.

## Disposition table

Filled during B.
