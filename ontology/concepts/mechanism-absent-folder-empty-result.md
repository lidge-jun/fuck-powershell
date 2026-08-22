---
id: mechanism-absent-folder-empty-result
type: Mechanism
label: "folder lookup answers empty instead of failing"
---

## Definition

A known-folder lookup verifies the directory before answering and returns an empty string rather than an error when it is absent, and that empty string is a valid argument to every path function downstream, so the failure becomes a relative path instead of an exception.
