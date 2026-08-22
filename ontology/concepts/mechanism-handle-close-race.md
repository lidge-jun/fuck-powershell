---
id: mechanism-handle-close-race
type: Mechanism
label: "exit races a closing handle"
---

## Definition

An immediate process exit tears the runtime down without waiting for libuv to finish closing handles; a handle still in the closing state trips an assertion, which Windows surfaces as a fastfail while POSIX teardown absorbs the same race silently.
