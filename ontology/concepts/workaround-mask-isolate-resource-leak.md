---
id: workaround-mask-isolate-resource-leak
type: Workaround
label: "mask isolate resource leak"
---

## Definition

Raise the batch timeout, run the file alone, or reorder files to avoid a shared-process test resource leak.

## Why it's unsafe

These changes only hide when leaked timers and sockets are observed; they do not make the request or test teardown own those resources.
