---
id: workaround-eol-boundary-normalization
type: Workaround
label: "normalize line endings at the pipeline boundary"
---

## Definition

Measure the file's dominant line ending from the original bytes, convert to LF for the interior transforms, and restore that ending on write, hashing the final bytes rather than the normalized interior.
