---
id: mechanism-unc-provider-semantics
type: Mechanism
label: "a UNC path may be served by a non-NTFS provider"
---

## Definition

A UNC root can be backed by a provider with entirely different semantics from NTFS, such as the WSL 9P filesystem, so operations that assume a Windows security descriptor fail with access-denied on a path that reads and lists normally.
