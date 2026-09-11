---
id: mechanism-loose-string-escape-layer
type: Mechanism
label: "loose string escape layer"
---

## Definition

A loose string or config layer consumes a backslash as an escape introducer and keeps the letter after it, so a Windows path silently loses its separators. A strict parser refuses the same input instead, which is why the failure arrives late.

