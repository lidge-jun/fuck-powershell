---
title: "Python text mode injects carriage returns into a pipe, so the bytes that land on disk are not the string you sent"
description: "encoding landmine — silent (both)"
sidebar:
  label: "python textio newline translation"
---

<p class="case-eyebrow">encoding · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#universal-newline-write">universal-newline-write</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">python, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">universal newline write</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">write through buffer</span></span></div></div>

# Python text mode injects carriage returns into a pipe, so the bytes that land on disk are not the string you sent

## Symptom

You write a string through a subprocess pipe, the child writes it to a file, and
a verification read back does not match what you sent. Byte counts disagree by
exactly the number of lines:

```
wrote 39 bytes, read back 42
```

A patch tool reports a false negative. A checksum never matches. A round-trip test
that passes on CI passes on Linux and fails on the Windows runner, and diffing the
two strings shows nothing, because the difference has no glyph.

## Repro

```python
open("t.txt", "w").write("a\nb\n")
len(open("t.txt", "rb").read())   # 6 on Windows, 4 on POSIX
```

The same wrapper sits in a text-mode pipe, so the child receives bytes the parent
never wrote:

```python
import subprocess, sys
child = [sys.executable, "-c",
         "import sys;sys.stdout.buffer.write(repr(sys.stdin.buffer.read()).encode())"]
p = subprocess.run(child, input="a\nb\n", text=True, capture_output=True)
p.stdout   # b'a\r\nb\r\n' on Windows, b'a\nb\n' on POSIX
```

## Cause

CPython's text-mode I/O implements universal newlines in BOTH directions. Reading
translates any line ending to `\n`, which everyone knows. Writing translates
`\n` to `os.linesep` — `\r\n` on Windows — which is the half that surprises
people, because nothing in `write("a\nb")` suggests the bytes will change.

It applies wherever a `TextIOWrapper` sits in the path, and a subprocess pipe
opened with `text=True` (or `encoding=`) is exactly that. So the translation
happens INSIDE the pipe, before the child sees anything — the child is not
misbehaving, and neither is the filesystem.

That placement is what makes it expensive to debug: your string is correct, the
child's write is correct, the file on disk is wrong, and the only wrong step is a
pipe that both sides consider transparent.

POSIX has the same API and no translation, so the bug is invisible until a
Windows runner produces it.

## Workaround

Write through the binary buffer, which bypasses the wrapper entirely:

```python
p = subprocess.Popen(["cat"], stdin=subprocess.PIPE)      # no text=True
p.stdin.write("a\nb\n".encode("utf-8"))
```

If you must keep `text=True`, pin the translation off:

```python
subprocess.Popen(cmd, stdin=PIPE, text=True, newline="")   # no translation
open(path, "w", newline="").write(data)                    # same for files
```

`newline=""` is the specific spelling that means "write exactly what I gave you";
`newline="\n"` also works and is clearer about intent.

When you verify a round trip, normalize both sides before comparing. Even with the
write path fixed, any other component in the chain may translate, and a comparison
that tolerates line endings is cheaper than one more silent false negative.

---

`split-n-leaves-cr` is the read side of CRLF damage and
`lf-pure-transform-mixes-eol` is the file-rewrite side. This one is upstream of
both: the CRs were not in the file and not in your string — a pipe added them in
transit.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/48>
- <https://github.com/NousResearch/hermes-agent/commit/8f91d7bf>
