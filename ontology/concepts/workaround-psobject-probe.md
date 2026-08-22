---
id: workaround-psobject-probe
type: Workaround
label: "psobject probe"
---

## Definition

Probe $obj.PSObject.Properties.Name -contains 'key' before dereferencing optional fields under StrictMode.
