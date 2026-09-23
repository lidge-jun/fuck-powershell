---
title: Landmine Ontology
description: The failure graph behind the archive.
---

Every case is annotated with typed edges — what it affects, what it invokes,
which mechanism causes it, what error it manifests as, and which workarounds are
safe or tempting-but-unsafe. The graph powers the [fp lookup engine](/fuck-powershell/skill/).

| type | count |
|---|---|
| Workaround | 119 |
| Mechanism | 74 |
| Command | 39 |
| ErrorSignature | 33 |
| Runtime | 3 |
| Shell | 3 |
| Environment | 4 |
| Case | 110 |

Total: 385 nodes, 811 edges. Generated from case
frontmatter — see [Mechanisms](/fuck-powershell/ontology/mechanisms/) and
[Error signatures](/fuck-powershell/ontology/errors/).
