---
title: "Tee-Object writes UTF-16, so grepping your own log returns zero matches twice over"
description: "encoding landmine — silent (5.1)"
sidebar:
  label: "tee object UTF-16"
---

<p class="case-eyebrow">encoding · case</p>

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#default-encoding">default-encoding</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, node, windows, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">MOJIBAKE</span></div><div class="row"><span class="k">Mechanism</span><span class="v">default encoding</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">set content utf8nobom</span></span></div></div>

## Symptom

You tee a test run to a log so you can grep it afterwards. The console output is
perfect. Every subsequent filter returns **zero matches** — not an error, not a
partial result, just nothing. So you conclude the suite printed nothing and start
debugging the wrong thing.

## Repro

```powershell
"not ok 1 - boom" | Tee-Object -FilePath $env:TEMP\t.txt | Out-Null
```

```js
const raw = readFileSync(process.env.TEMP + "\\t.txt");
raw.slice(0, 8).toString("hex");                 // fffe6e006f007400  <- UTF-16LE + BOM
raw.toString("utf8").split(/\r?\n/)
   .filter((l) => /^not ok/.test(l)).length;     // 0
raw.toString("utf16le").split(/\r?\n/)
   .filter((l) => /^not ok/.test(l)).length;     // 0   <- still zero!
```

## Cause

Two layers, and fixing only the first still gives you zero:

1. `Tee-Object -FilePath` inherits the 5.1 default encoding: **UTF-16LE with
   BOM**. Reading as UTF-8 yields `n\0o\0t\0` — the anchor `^not ok` never matches.
2. Decode as `utf16le` and you *still* get zero, because the BOM survives as
   `U+FEFF` at the head of the first line, so `^` no longer sits against `n`.

The zero-match result is identical for "the file is empty", "the pattern is
wrong", and "the encoding is wrong", which is what makes this expensive.

## Workaround

```powershell
npm test 2>&1 | Out-File -Encoding utf8 run.log      # 5.1: UTF-8 with BOM
npm test 2>&1 | Set-Content -Encoding utf8NoBOM run.log  # 7+: clean
```

When a POSIX consumer must read it on 5.1, drop to .NET:
`[System.IO.File]::WriteAllText($path, $text)`. On the reader side, strip a
leading `U+FEFF` before anchoring — decoding correctly is not enough.

---

`oss-outfile-bom` covers `Out-File` and `>`. This is the same default reached
through a different cmdlet, and it deserves its own entry because `Tee-Object` is
specifically the thing you add **in order to grep later** — so the failure lands
exactly where you were about to look. The BOM-survives-utf16le-decode half is not
covered by that case either.

## Real-world hit

Hit while auditing a Windows CI failure in lidge-jun/codexclaw: the suite summary
lines were filtered out of a tee'd log, making a 1901-test run look like it
produced no output at all.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/3>
