---
title: Landmine Ontology
description: The failure graph behind the archive.
---

Every case is annotated with typed edges — what it affects, what it invokes,
which mechanism causes it, what error it manifests as, and which workarounds are
safe or tempting-but-unsafe. The graph powers the [fp lookup engine](/fuck-powershell/skill/).

| type | count |
|---|---|
| Command | 39 |
| Environment | 4 |
| ErrorSignature | 33 |
| Mechanism | 74 |
| Runtime | 3 |
| Shell | 3 |
| Workaround | 118 |
| Case | 109 |

Total: 383 nodes, 804 edges. Generated from case
frontmatter — see [Mechanisms](/fuck-powershell/ontology/mechanisms/) and
[Error signatures](/fuck-powershell/ontology/errors/).
