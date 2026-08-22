---
id: workaround-explicit-json-depth
type: Workaround
label: "explicit json depth"
---

## Definition

Always pass -Depth explicitly to ConvertTo-Json for nested data (5.1/7.0 truncate silently; 7.1+ warn).
