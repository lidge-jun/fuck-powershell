---
id: workaround-fsync-on-rdwr-handle
type: Workaround
label: "fsync on rdwr handle"
---

## Definition

Open the handle used for fsync with "r+"/O_RDWR, or flush through the descriptor the write used before closing it; never reopen read-only just to flush.
