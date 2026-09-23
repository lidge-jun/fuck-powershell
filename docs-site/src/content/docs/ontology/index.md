---
title: Landmine Ontology
description: The failure graph behind the archive.
---

Every case is annotated with typed edges — what it affects, what it invokes,
which mechanism causes it, what error it manifests as, and which workarounds are
safe or tempting-but-unsafe. The graph powers the [fp lookup engine](/fuck-powershell/skill/).

| type | count |
|---|---|
| Workaround | 124 |
| Mechanism | 78 |
| Command | 39 |
| ErrorSignature | 33 |
| Runtime | 3 |
| Shell | 3 |
| Environment | 4 |
| Case | 112 |

Total: 396 nodes, 826 edges. Generated from case
frontmatter — see [Mechanisms](/fuck-powershell/ontology/mechanisms/) and
[Error signatures](/fuck-powershell/ontology/errors/).
