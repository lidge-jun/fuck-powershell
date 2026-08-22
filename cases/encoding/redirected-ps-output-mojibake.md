---
id: redirected-ps-output-mojibake
title: "capturing PowerShell output from another program mangles every non-ASCII character, because redirected output is encoded in the console codepage"
category: encoding
versions: "5.1"
failure: silent
context: [script, agent, ci]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/opencodex/commit/f642a7b1f
ontology:
  affects: [shell-powershell-51, env-windows, env-korean-codepage, runtime-node]
  invokes: [command-powershell]
  manifests_as: [error-mojibake]
  caused_by: [mechanism-default-encoding]
  mitigated_by: [workaround-base64-utf16-payload]
---

# capturing PowerShell output from another program mangles every non-ASCII character, because redirected output is encoded in the console codepage

## Symptom

You shell out to `powershell.exe -Command` from Node, Python, or Go to ask
Windows something it only tells PowerShell — a profile path, an account name, a
registry value. The answer comes back correct for English users and corrupted for
everyone else:

```
expected: C:\Users\정준\AppData\Local
received: C:\Users\ъ á\AppData\Local
```

Run the same command interactively and it prints perfectly. The corruption
appears only when the output is captured, which means it survives every manual
test and fails on the user's machine.

## Repro

```js
const { execFileSync } = require("node:child_process");
const out = execFileSync("powershell.exe",
  ["-NoProfile", "-Command", "[Environment]::GetFolderPath('LocalApplicationData')"],
  { encoding: "utf8" });
// non-ASCII characters in the path arrive as replacement junk
```

Decoding as UTF-8 is not the bug and switching to `latin1` is not the fix: the
bytes are in whatever the active codepage is — 949, 932, 1252 — which you do not
know and cannot assume.

## Cause

Windows PowerShell 5.1 encodes redirected output using `[Console]::OutputEncoding`,
which defaults to the console's active codepage rather than to UTF-8. A legacy
codepage cannot represent most non-ASCII characters, so they are replaced during
encoding — before your process ever sees a byte. The information is gone at the
source; no decoding choice on your side can recover it.

It is invisible interactively because the console renders with the same codepage
it encoded with, so the round trip looks lossless on screen.

PowerShell 7 defaults to UTF-8 and mostly avoids this, but you do not get to
choose which one is on the machine: `powershell.exe` is 5.1 and is the one
guaranteed to exist.

## Workaround

Do not let the text cross the boundary as text. Have PowerShell encode the value
into ASCII on its side and decode it on yours:

```js
const expr = "[Environment]::GetFolderPath('LocalApplicationData')";
const script = [
  "$ErrorActionPreference = 'Stop'",
  `$v = [string](${expr})`,
  "$b = [System.Text.Encoding]::Unicode.GetBytes($v)",
  "[Console]::Out.Write([Convert]::ToBase64String($b))",
].join("; ");

const b64 = execFileSync("powershell.exe",
  ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
  { encoding: "utf8" });

const value = Buffer.from(b64.trim(), "base64").toString("utf16le");
```

Base64 is pure ASCII, so every codepage transmits it unchanged, and UTF-16LE is
what Windows strings already are — no lossy step anywhere in the chain. Validate
the base64 shape before decoding, so a PowerShell error message on stdout fails
loudly instead of decoding into garbage.

Setting `[Console]::OutputEncoding = [Text.Encoding]::UTF8` inside the script is
the lighter fix and works in many cases, but it mutates console state your caller
may share, and on 5.1 it interacts badly with a host that has already written
output.

---

The corpus's other encoding cases are about files you WRITE — BOMs, UTF-16
defaults, CP949 script files. This one is about a value in flight: the file
system is fine, the string is fine, and the pipe between two processes is where
it dies.
