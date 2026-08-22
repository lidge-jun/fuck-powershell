---
id: error-invalid-url-scheme
type: ErrorSignature
label: "ERR_UNSUPPORTED_ESM_URL_SCHEME"
---

## Definition

Node's ESM loader rejects a specifier whose scheme is not file, data, or node; on Windows an absolute path supplies its drive letter as the scheme.
