---
id: workaround-normalize-before-url
type: Workaround
label: "normalize separators before constructing a URL"
---

## Definition

Convert separators to forward slashes and prefix a drive-absolute path with a slash before handing it to a URL type, or use the runtime's path-to-file-URL helper, so no separator is percent-encoded as data.
