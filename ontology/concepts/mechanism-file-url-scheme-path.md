---
id: mechanism-file-url-scheme-path
type: Mechanism
label: "file url scheme path"
---

## Definition

A file: URL's pathname keeps the leading slash and treats the drive letter as the first segment (/D:/a/...), which is a valid URL path but not a Windows filesystem path; only fileURLToPath converts and decodes it.
