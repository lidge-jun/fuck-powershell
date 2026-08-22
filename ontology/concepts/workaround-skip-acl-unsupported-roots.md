---
id: workaround-skip-acl-unsupported-roots
type: Workaround
label: "skip roots that cannot carry an ACL, and report the skip"
---

## Definition

Canonicalize a path and match the known ACL-unsupported UNC roots before attempting a security operation, skipping rather than failing the run, and surface the skip so an unhardened directory is a visible outcome.
