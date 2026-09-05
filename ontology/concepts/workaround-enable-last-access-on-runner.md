---
id: workaround-enable-last-access-on-runner
type: Workaround
label: "enable last-access on runner"
---

## Definition

fsutil behavior set DisableLastAccess 0 on the CI machine so atime updates again.

## Why it's unsafe

Needs elevation, does not survive a fresh runner image, and leaves the test asserting on a filesystem policy rather than on the read it claims to observe.

