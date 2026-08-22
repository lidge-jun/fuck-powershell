---
id: error-ebusy
type: ErrorSignature
label: "EBUSY: resource busy or locked"
---

## Definition

Node reports EBUSY when Windows refuses a rename or delete because another handle holds the file without FILE_SHARE_DELETE; the error names neither the holder nor the reason.
