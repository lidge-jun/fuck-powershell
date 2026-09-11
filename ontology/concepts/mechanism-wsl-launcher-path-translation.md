---
id: mechanism-wsl-launcher-path-translation
type: Mechanism
label: "wsl launcher path translation"
---

## Definition

The WSL launcher on PATH is not a POSIX shell. It starts a guest with no C: drive and consumes the backslashes of a Windows path handed to it, so the path cannot resolve. Its callers have reported it exiting 0 on that failure.

