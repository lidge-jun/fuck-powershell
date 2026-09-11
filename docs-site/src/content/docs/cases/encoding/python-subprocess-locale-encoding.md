---
title: "subprocess text=True decodes the child with the ANSI codepage under strict errors, so one unmappable byte raises UnicodeDecodeError instead of returning output"
description: "encoding landmine — hard-error (both)"
sidebar:
  label: "python subprocess locale encoding"
---

<p class="case-eyebrow">encoding · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#locale-preferred-encoding">locale-preferred-encoding</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">python, windows, korean codepage</span></div><div class="row"><span class="k">Fails as</span><span class="v">MOJIBAKE</span></div><div class="row"><span class="k">Mechanism</span><span class="v">locale preferred encoding</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">explicit subprocess encoding</span></span></div></div>

# subprocess text=True decodes the child with the ANSI codepage under strict errors, so one unmappable byte raises UnicodeDecodeError instead of returning output

## Symptom

A command runs fine in the terminal and blows up through Python, with a decode
failure naming a codec you never chose:

```
UnicodeDecodeError: 'gbk' codec can't decode byte 0x86 in position 12
```

You did not ask for GBK. On a Korean machine it says `cp949`, on a Japanese one
`cp932`, on a Western one `cp1252` — and in a US-English CI job with ASCII output
it never happens at all, which is why it reaches users rather than tests.

If your code reads the child through a wrapper thread rather than
`subprocess.run`, the same decode failure can surface as EMPTY output instead of
an exception: the reader dies, the parent sees `None`, and the command looks like
it produced nothing. That variant is worse, because there is no traceback to
follow.

## Repro

The failure needs a byte the ANSI codepage cannot map, so pick output the child
emits as UTF-8 while the parent decodes as something else:

```python
import subprocess
# a UTF-8-emitting child (an emoji or a check mark) read on a cp1252 or cp949 box
subprocess.run([sys.executable, "-c", "import sys;sys.stdout.buffer.write('✓'.encode())"],
               capture_output=True, text=True)
# UnicodeDecodeError: 'cp1252' codec can't decode byte 0x9c in position 1
```

Note what does NOT fail: `echo 한글` on a Korean machine is valid cp949, so it
decodes cleanly. The trap needs a MISMATCH between what the child emits and what
the parent's locale says, not merely non-ASCII text.

And the fix that looks right and is also wrong:

```python
subprocess.run(cmd, capture_output=True, text=True,
               encoding="utf-8", errors="replace")
# native tools emit ANSI/OEM bytes; those now become U+FFFD irreversibly
```

## Cause

`text=True` without an explicit `encoding=` decodes the child's bytes with the
interpreter's locale encoding, which on Windows is the ANSI codepage from
`GetACP` — cp949, cp932, cp936, cp1252 — not UTF-8, and notably not the CONSOLE
codepage either, which is a different value (cp437 or cp850 on a Western box).
The default error handler is `strict`, so one unmappable byte raises rather than
substituting.

Two things make this harder than it looks.

First, there is no single right answer. Different children emit different
encodings on the same machine: a Python child under UTF-8 mode emits UTF-8, while
`schtasks` or `tasklist` emit the OEM codepage. Hardcoding `encoding="utf-8"`
fixes one and breaks the other, and `errors="replace"` makes the breakage
unrecoverable because the original bytes are gone.

Second, `PYTHONUTF8=1` and PEP 540 UTF-8 mode change YOUR interpreter's default,
not what the child produces. They make the locale-encoding lookup report
`utf-8` while native tools keep emitting the ANSI or OEM codepage — so the
function you would reach for to detect the mismatch stops reporting it.

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

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/47>
- <https://github.com/NousResearch/hermes-agent/commit/5b5b5e8d>
- <https://github.com/NousResearch/hermes-agent/issues/83767>
- <https://github.com/NousResearch/hermes-agent/issues/89442>
