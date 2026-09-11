---
id: workaround-tri-parser-noop
type: Workaround
label: "tri parser noop"
---

## Definition

When a file must be inert under an interpreter you cannot predict, make its whole body a lone #!/bin/sh line. bash, python and node all read it as a comment and exit 0. A bash shebang plus exit 0 does not.

