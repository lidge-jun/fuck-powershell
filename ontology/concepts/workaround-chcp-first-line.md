---
id: workaround-chcp-first-line
type: Workaround
label: "chcp 65001 as the first executable line"
---

## Definition

Keep a batch file BOM-less and switch the codepage with chcp before any line carrying non-ASCII text, since cmd.exe decodes each line as it reads it and treats a BOM as ordinary characters.
