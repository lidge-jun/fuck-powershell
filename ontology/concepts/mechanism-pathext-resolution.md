---
id: mechanism-pathext-resolution
type: Mechanism
label: "pathext resolution"
---

## Definition

Windows resolves extensionless command names by walking PATH entries and PATHEXT extensions in order; results differ from POSIX execvp and between resolvers.
