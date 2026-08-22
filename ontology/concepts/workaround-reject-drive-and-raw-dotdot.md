---
id: workaround-reject-drive-and-raw-dotdot
type: Workaround
label: "normalize first, then reject drive letters and raw traversal"
---

## Definition

Normalize an archive entry before testing it, reject any raw parent segment plus the drive-letter and UNC forms that a POSIX absolute check cannot see, and confirm the resolved path still lies inside the destination.
