---
id: bom-less-ps1-cp949
title: A BOM-less .ps1 is read as ANSI — non-ASCII corrupts before execution
category: encoding
versions: "5.1"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/blob/main/src/prompt/templates/a1-system.md
  - https://github.com/lidge-jun/cli-jaw/commit/7f0c655beb9eb3b3a426a3a155c88af232f12ff7
  - https://github.com/lidge-jun/opencodex/commit/ff6916abcde01de60a1b1ac4ce7adb4c8efad6de
  - https://github.com/lidge-jun/opencodex/commit/22e156e25aed5bc06fc73a6e9c1fa00eb38049b3
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
