---
id: error-enametoolong
type: ErrorSignature
label: "ENAMETOOLONG / PathTooLongException"
---

## Definition

Win32 reports a path over the API ceiling as ERROR_FILENAME_EXCED_RANGE or ERROR_BUFFER_OVERFLOW; Node surfaces both as ENAMETOOLONG while Python maps the same code to ENOENT, so one wall is reported as two different problems.
