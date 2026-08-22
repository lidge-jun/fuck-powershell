---
id: mechanism-max-path-ceiling
type: Mechanism
label: "MAX_PATH is an API ceiling, not a filesystem limit"
---

## Definition

Win32 caps a pathname at 260 characters including drive, separators, and the terminating NUL, and directory creation reserves twelve more, so a path NTFS would store is refused by the API unless the caller uses the extended-length prefix or opts in with both the registry value and a long-path-aware manifest.
