---
id: mechanism-separator-as-url-data
type: Mechanism
label: "backslash is data inside a URL path"
---

## Definition

A general-purpose URL type percent-encodes a backslash because it is an ordinary path character rather than a separator; only implementations following the WHATWG special-scheme rule convert it, so the same conversion is correct in one language and broken in another.
