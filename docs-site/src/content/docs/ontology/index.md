---
title: Landmine Ontology
description: The failure graph behind the archive.
---

Every case is annotated with typed edges — what it affects, what it invokes,
which mechanism causes it, what error it manifests as, and which workarounds are
safe or tempting-but-unsafe. The graph powers the [fp lookup engine](/fuck-powershell/skill/).

| type | count |
|---|---|
| Workaround | 87 |
| Mechanism | 55 |
| Command | 39 |
| Runtime | 3 |
| ErrorSignature | 23 |
| Shell | 3 |
| Environment | 4 |
| Case | 86 |

Total: 300 nodes, 613 edges. Generated from case
frontmatter — see [Mechanisms](/fuck-powershell/ontology/mechanisms/) and
[Error signatures](/fuck-powershell/ontology/errors/).
