---
id: python-subprocess-locale-encoding
title: "subprocess text=True decodes the child with the console codepage, so one CJK byte raises UnicodeDecodeError and stdout comes back empty"
category: encoding
versions: "both"
failure: hard-error
context: [script, agent, ci]
source: third-party
repro: historical
refs:
  - https://github.com/NousResearch/hermes-agent/commit/5b5b5e8d
  - https://github.com/NousResearch/hermes-agent/issues/83767
  - https://github.com/NousResearch/hermes-agent/issues/89442
ontology:
  affects: [runtime-python, env-windows, env-korean-codepage]
  manifests_as: [error-mojibake]
  caused_by: [mechanism-locale-preferred-encoding]
  mitigated_by: [workaround-explicit-subprocess-encoding]
---

# subprocess text=True decodes the child with the console codepage, so one CJK byte raises UnicodeDecodeError and stdout comes back empty

## Symptom

A command runs fine in the terminal and returns nothing through Python. Either
the output is empty with no error, or you get a decode failure naming a codec you
never chose:

```
UnicodeDecodeError: 'gbk' codec can't decode byte 0x86 in position 12
```

You did not ask for GBK. On a Korean machine it says `cp949`, on a Japanese one
`cp932`, and in a US console it never happens at all — which is why it reaches
users rather than CI.

The empty-stdout variant is worse: the reader thread dies on the decode, the
parent sees `None` or `""`, and your code concludes the command produced no
output.

## Repro

```python
import subprocess
r = subprocess.run(["cmd", "/c", "echo 한글"], capture_output=True, text=True)
# on a cp949 console this decodes as cp949; a byte the codepage cannot map
# raises UnicodeDecodeError under the default errors="strict"
```

And the fix that looks right and is also wrong:

```python
subprocess.run(cmd, capture_output=True, text=True,
               encoding="utf-8", errors="replace")
# native tools emit ANSI/OEM bytes; those now become U+FFFD irreversibly
```

## Cause

`text=True` without an explicit `encoding=` decodes the child's bytes with
`locale.getpreferredencoding(False)`, which on Windows is the ANSI codepage —
cp949, cp932, cp936, cp1252 — not UTF-8. The default error handler is
`strict`, so a single unmappable byte raises rather than substituting.

Two things make this harder than it looks.

First, there is no single right answer. Different children emit different
encodings on the same machine: a Python child under UTF-8 mode emits UTF-8, while
`schtasks` or `tasklist` emit the OEM codepage. Hardcoding `encoding="utf-8"`
fixes one and breaks the other, and `errors="replace"` makes the breakage
unrecoverable because the original bytes are gone.

Second, `PYTHONUTF8=1` and PEP 540 UTF-8 mode change YOUR interpreter's default,
not what the child produces. Worse, they make
`locale.getpreferredencoding(False)` report `utf-8` while native tools keep
emitting the ANSI codepage — so the function you would use to detect the problem
starts lying about it.

## Workaround

Capture bytes and decide the decoding yourself, per child:

```python
r = subprocess.run(cmd, capture_output=True)          # no text=True
out = r.stdout.decode("utf-8", errors="strict") if is_utf8_child \
      else r.stdout.decode(oem_codepage(), errors="replace")
```

When you know the child, be explicit rather than relying on the locale:

```python
subprocess.run(cmd, capture_output=True, text=True, encoding="cp949")
```

For a child you control, remove the ambiguity at the source — set
`PYTHONIOENCODING=utf-8` in its environment, or run `chcp 65001` before a
console tool — and then decode as UTF-8 on both sides.

Never combine a guessed encoding with `errors="replace"`. The replacement is
lossy and permanent, so a wrong guess stops raising and starts silently
corrupting, which is a worse failure than the one you were fixing.

---

`redirected-ps-output-mojibake` is the same wall from the PowerShell side, where
the CHILD encodes its redirected output with the console codepage. This is the
Python side: the parent decodes with it. Different fix — `encoding=` on the
Popen versus base64 framing in the child — and a different reader.
