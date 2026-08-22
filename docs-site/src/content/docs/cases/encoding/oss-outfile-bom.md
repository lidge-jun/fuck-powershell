---
title: "Out-File writes UTF-16; your POSIX tools read garbage"
description: "encoding landmine — silent (5.1)"
---

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span></div>

## Symptom

A file generated in a Windows CI step looks fine in PowerShell but breaks every
downstream consumer: git shows the whole file changed, grep finds nothing, Node
or Python parse errors on "empty" content, diffs are full of `\x00`.

## Repro

```powershell
# Windows PowerShell 5.1
"hello" | Out-File hello.txt
# bytes: FF FE 68 00 65 00 ...   <- UTF-16LE with BOM
"hello" > hello2.txt              # same: > IS Out-File
```

## Cause

In Windows PowerShell 5.1, `Out-File` (and therefore the `>` redirection operator)
defaults to UTF-16LE with BOM. POSIX toolchains expect UTF-8 without BOM. The
referenced CI fix migrated a workflow to `Set-Content -Encoding utf8NoBOM` under
pwsh after Unicode content corrupted in the 5.1 lane. PowerShell 7 changed the
default to BOM-less UTF-8, so the same script writes different bytes per runtime.

## Workaround

- Always pass an explicit encoding: `Out-File -Encoding utf8` (5.1: writes BOM)
  or `Set-Content -Encoding utf8NoBOM` (7+).
- On 5.1, when you need BOM-less UTF-8, drop to .NET:
  `[System.IO.File]::WriteAllText($path, $text)`.
- Lint generated artifacts for BOMs in CI.

## Refs

- <https://github.com/parsaesmaili038/ticketing-v1/commit/d5a4d513e34d557f345b41d9e1b9fdd2806d4a04>
