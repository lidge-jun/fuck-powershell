---
id: workaround-crlf-tolerant-split
type: Workaround
label: "split on the line break, not the newline character"
---

## Definition

Split text with a CRLF-tolerant pattern such as a slash-r-optional newline regex, or use a runtime line splitter that handles both terminators, so no carriage return survives into a comparison.
