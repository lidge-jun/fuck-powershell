---
id: workaround-escape-more-quotes
type: Workaround
label: "escape more quotes"
---

## Definition

Add more backslashes/quotes until the string appears to survive.

## Why it's unsafe

Backslash is not a PowerShell escape; layered quoting differs per hop (PS→cmd→CRT argv). It breaks on the next payload. Move data to files/stdin or use single-quoted literals.
