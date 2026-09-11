---
id: workaround-msys-no-pathconv
type: Workaround
label: "msys no pathconv"
---

## Definition

Set MSYS_NO_PATHCONV=1 for the invocation, or write the argument with a doubled leading slash, so MSYS hands it to the child unconverted. The doubled slash is narrower and leaves genuine POSIX paths still translated.

