---
id: workaround-use-birthtime-file-identity
type: Workaround
label: "use birthtime file identity"
---

## Definition

Use birthtime as a substitute identity when numeric Windows dev or ino values appear unreliable.

## Why it's unsafe

NTFS tunneling can preserve creation time when a name is deleted and recreated, so birthtime may match a replacement and admit the same false identity result.
