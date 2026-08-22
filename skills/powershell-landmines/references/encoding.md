
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


---


# Tee-Object writes UTF-16, so grepping your own log returns zero matches twice over

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


---


# A BOM-less .ps1 is read as ANSI — non-ASCII corrupts before execution

## Symptom

A script containing non-ASCII string literals (Korean paths, emoji, accented
names) behaves wrongly under Windows PowerShell 5.1: comparisons fail, files with
localized names are not found, output is mojibake. The same file runs perfectly
under pwsh 7. Console output "looking garbled" proves nothing — the corruption
happened at parse time.

## Repro

```powershell
# Save this WITHOUT a BOM as test.ps1 (UTF-8):   $s = "한글"; $s.Length
powershell.exe -File test.ps1   # 5.1 on a Korean host reads it as CP949: wrong Length
pwsh -File test.ps1             # 7: correct
```

The only reliable check is byte-level: inspect the literal's length/bytes, not how
the console renders it. This trap was documented as a hard rule for AI agents
writing Windows scripts (see ref): ".ps1 needs a UTF-8 BOM."

## Cause

Windows PowerShell 5.1 decides a script file's encoding by sniffing for a BOM.
No BOM means the legacy ANSI code page (CP949 on Korean systems, CP1252 on
Western ones). Every non-ASCII literal is corrupted before the script runs.
PowerShell 7 assumes UTF-8 by default, which is why the bug is invisible in
7-only testing — and why agents generating .ps1 files keep shipping it.

## Workaround

- Write .ps1 files as UTF-8 **with BOM** whenever 5.1 might run them.
- CI-lint your repo: any .ps1 containing non-ASCII bytes must start with EF BB BF.
- Verify with byte checks (`Format-Hex`, `$s.Length`), never with console output.


---


# Out-File writes UTF-16; your POSIX tools read garbage

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
