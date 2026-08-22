---
id: workaround-pathtofileurl
type: Workaround
label: "convert with pathToFileURL"
---

## Definition

Use the runtime's path-to-file-URL conversion rather than string concatenation, so the drive letter, the three-slash form, and percent-encoding of characters legal in paths but special in URLs are all handled together.
