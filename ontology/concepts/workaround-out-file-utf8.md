---
id: workaround-out-file-utf8
type: Workaround
label: "out file utf8"
---

## Definition

Out-File -Encoding utf8 to force UTF-8 on 5.1.

## Why it's unsafe

On 5.1 this writes UTF-8 WITH BOM, which still breaks anchored grep, hashbangs, and JSON parsers. utf8NoBOM does not exist on 5.1 — drop to [IO.File]::WriteAllText.
