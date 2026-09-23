---
id: workaround-own-request-deadline-and-teardown
type: Workaround
label: "own request deadline and teardown"
---

## Definition

Clear the sync deadline on every exit, bound request and socket teardown with one absolute timer, settle exactly once despite missing close or a throwing destroy(), and await server.stop(true) in teardown.
