---
id: workaround-base64-utf16-payload
type: Workaround
label: "carry the value across as base64 UTF-16"
---

## Definition

Have the child process encode a non-ASCII value as base64 over UTF-16LE bytes and decode it in the parent, so no legacy console codepage sits between the value and its consumer.
