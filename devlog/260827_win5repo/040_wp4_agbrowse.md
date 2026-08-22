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

## Yield

One NEW, at the low end of the zero-to-two expectation. agbrowse's 18-row
inventory is mostly web-ai poll-deadline work that matched the Tier B grep on
"path" and "spawn" rather than on anything Windows-shaped, which is what a young
repo with no native-Windows lane looks like.

| id | category | mechanism |
|---|---|---|
| zip-entry-drive-letter-escapes | parsing | a drive letter is absolute without a leading slash, so a POSIX absolute check passes an archive entry that escapes the destination |

The three other hypotheses from this doc did not materialize. Chrome executable
discovery and registry App Paths never appear in this history — agbrowse takes an
explicit executable path. Process-tree termination appears only as POSIX-side
cleanup. The profile-lock work (b9024a6af) is a cooperative lock file with stale
reclaim, not the Windows mandatory-lock mechanism, so it does not even REF
`unlink-while-open-ebusy`.

That last point is the merge-dedupe rule from 001 resolving cleanly: both this
doc and 030 nominated file locking, ima2-gen supplied the actual evidence in wp3
and owns the case, and agbrowse turned out to have nothing to add rather than a
near-duplicate to append.

## Disposition table

| sha | disposition |
|---|---|
| f1d8b1e74 | REJECT test-only |
| 0ec3abb1c | REJECT test-only (same change, second branch) |
| 3b26afb4b | REJECT docs-only |
| 059885d9a | REJECT docs-only |
| 80fc59d76 | REJECT no-windows-mechanism (web UI picker shell) |
| a2171c32a | REJECT no-windows-mechanism (same) |
| 982ef8cbe | REJECT no-windows-mechanism (poll deadline vs store lock) |
| 4624f5da8 | REJECT no-windows-mechanism (poll deadline escapes) |
| 6697e6a3f | REJECT test-only |
| 89357fd0b | REJECT no-windows-mechanism (resume path deadlines) |
| 21e229c9c | REJECT test-only |
| 286e9982a | REJECT docs-only |
| f59d96366 | REJECT no-windows-mechanism (hydration grace for empty shells) |
| 817356e7b | REJECT test-only (macOS /var symlink realpath in fixtures; POSIX-side) |
| 4a5e09613 | REJECT repo-specific (CI chromium install) |
| a5519f3a5 | NEW zip-entry-drive-letter-escapes |
| b21aae833 | REF zip-entry-drive-letter-escapes (the normalization-order half of the same guard) |
| b9024a6af | REJECT no-windows-mechanism (cooperative profile lock file with stale reclaim; not mandatory locking) |

## Judgment calls

- `b9024a6af` was the one I expected to REF `unlink-while-open-ebusy`. Reading it,
  the lock is a JSON file with a heartbeat and a 5-minute stale reclaim — an
  application-level protocol that works identically on every OS. Chrome's own
  mandatory profile lock is real, but this commit is not evidence of it.
- `817356e7b` realpaths tmpdirs, which looks adjacent to `esm-is-main-file-url`.
  It is the macOS `/var` to `/private/var` symlink, a POSIX-side fact, so it is
  not Windows evidence.
- Fifteen of eighteen rows entered the inventory through Tier B terms (`path`,
  `spawn`, `shell`) with no Windows content. That is the cost of the broader tier
  on a repo with no Windows lane, and it is recorded rather than hidden: a
  cheaper grep would have produced a smaller inventory and the same one case.
