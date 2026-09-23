---
id: workaround-bigint-file-identity
type: Workaround
label: "bigint file identity"
---

## Definition

Read Windows file identity using lstatSync(path, { bigint: true }) and fail closed when dev or ino is absent, null, or zero.
