---
id: utf8-bom-still-breaks-grep
title: "the recommended fix still breaks anchored grep - Out-File -Encoding utf8 writes a BOM, and utf8NoBOM does not exist on 5.1"
category: encoding
versions: "5.1"
failure: silent
context: [ci, script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/7
---

# the recommended fix still breaks anchored grep - Out-File -Encoding utf8 writes a BOM, and utf8NoBOM does not exist on 5.1

## Symptom

You already know about the UTF-16 default, so you do the recommended thing and
pass an explicit encoding. Your grep **still** finds nothing:

```powershell
npm test | Out-File -Encoding utf8 run.log
# then, from any POSIX-minded reader:
# lines matching /^not ok/  ->  0
```

And the other recommended fix does not exist at all:

```
Set-Content : Cannot bind parameter 'Encoding'. Cannot convert value "utf8NoBOM"
... Specify one of the following enumerator names and try again:
Unknown, String, Unicode, Byte, BigEndianUnicode, UTF8, UTF7, UTF32, Ascii, Default, Oem, BigEndianUTF32
```

So the fix you were told to apply either silently keeps the bug or refuses to run.

## Repro

Byte-level probe, same one line written five ways:

| how | bytes | head | BOM | `/^not ok/` matches |
|---|---|---|---|---|
| `Set-Content` (default) | 10 | `6e6f74206f6b2031` | none | **1** |
| `Add-Content` (default) | 10 | `6e6f74206f6b2031` | none | **1** |
| `Out-File` (default) | 22 | `fffe6e006f007400` | UTF-16LE | 0 |
| `>` redirect | 22 | `fffe6e006f007400` | UTF-16LE | 0 |
| `Out-File -Encoding utf8` | 13 | `efbbbf6e6f74206f` | **UTF-8 BOM** | **0** |
| `[IO.File]::WriteAllText` | 8 | `6e6f74206f6b2031` | none | **1** |

The `-Encoding utf8` row is the whole point: the encoding is now correct, the
text decodes perfectly, and the anchored match is still zero.

## Cause

Two separate things, and knowing only the first is what makes this expensive.

1. On 5.1, `Out-File -Encoding utf8` writes UTF-8 **with** a BOM. The BOM
   decodes to `U+FEFF` and sits in front of the first line, so `^` no longer
   touches `n`. Every unanchored pattern still matches, which is why this
   survives casual testing — swap `^not ok` for `not ok` and it "works".
2. `utf8NoBOM` is a PowerShell 7 enum value. On 5.1 the parameter binder rejects
   it outright, so copy-pasting the modern advice into a 5.1 lane is a hard error
   rather than a silent one.

Note the asymmetry that makes this counter-intuitive: `Set-Content` and
`Add-Content` default to **no BOM** on 5.1 and are fine, while `Out-File` and
`>` are not. The cmdlet you pick matters more than the encoding you pass.

## Workaround (verified on 5.1)

```powershell
# best: skip the cmdlet layer entirely
[System.IO.File]::WriteAllText("$env:TEMP\run.log", $text)   # 8 bytes, no BOM

# or use a cmdlet whose default is already BOM-less on 5.1
$text | Set-Content run.log
```

On the reading side, strip a leading `U+FEFF` before anchoring. Decoding
correctly is not sufficient:

```js
const text = readFileSync(f, "utf8").replace(/^\uFEFF/, "");
```

---

`oss-outfile-bom` covers the UTF-16 default and **recommends
`Out-File -Encoding utf8` (5.1) or `Set-Content -Encoding utf8NoBOM` (7+)**.
This case reports that on 5.1 the first recommendation still breaks anchored
matching via a UTF-8 BOM, and the second is not a valid parameter value at all.
It is a correction to that case's workaround section as much as a new landmine.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11.
