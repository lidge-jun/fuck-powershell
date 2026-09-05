---
id: workaround-retry-transient-remove
type: Workaround
label: "retry transient remove"
---

## Definition

Retry rmSync on EPERM, EBUSY and ENOTEMPTY with a short bounded backoff to ride out antivirus and indexer handles on freshly written files.

## Why it's unsafe

As the primary fix it masks an unowned child: the retry budget is a guess, the child still runs, and outside the test the same handle blocks an uninstaller or a home move.
