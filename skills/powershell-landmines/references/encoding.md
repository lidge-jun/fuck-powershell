
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


# a batch file with a non-ASCII path dies with 9009, and adding a BOM to fix it fuses onto the first line and kills it differently

## Symptom

You generate a `.cmd` wrapper — an autostart shim, a service launcher, a
scheduled-task entry — and it works on your machine and fails on someone else's.
The exit code is `9009`, which cmd.exe means as "command not recognized", so you
go hunting for a missing binary that is right there on disk.

The actual difference is that their user name, or their install directory, is not
ASCII. Every path in the file that contains a Korean, Japanese, or accented
character arrives at cmd.exe as mojibake, and the path it tries to run does not
exist.

Then you fix the encoding the obvious way, save the file as UTF-8 with a BOM, and
it breaks again — differently.

## Repro

Write a wrapper containing a non-ASCII path and run it from a console whose OEM
codepage is not UTF-8 (the default on most non-English Windows installs):

```
PS> $body = "@ECHO OFF`r`nECHO C:\Users\정준\app`r`n"
PS> [IO.File]::WriteAllText("t.cmd", $body, [Text.UTF8Encoding]::new($false))
PS> cmd /c t.cmd
C:\Users\ъ á\app
```

Now save it WITH a BOM and watch the failure move:

```
PS> [IO.File]::WriteAllText("t.cmd", $body, [Text.UTF8Encoding]::new($true))
PS> cmd /c t.cmd
'∩╗┐@ECHO' is not recognized as an internal or external command,
operable program or batch file.
```

The exact garbage in front of `@ECHO` is whatever your console codepage makes of
the three BOM bytes `EF BB BF` — `∩╗┐` on a 437 or 850 console, something else on
949 or 932. The shape is the same everywhere: the BOM became characters, they
fused onto the first token, and cmd.exe went looking for a command by that name.

## Cause

cmd.exe reads a BOM-less batch file in the console's OEM codepage — 437 or 850 on
Western installs, 949 on Korean, 932 on Japanese — not in UTF-8. Bytes you wrote
as UTF-8 are decoded as something else, and any non-ASCII path becomes a different
path. Which mojibake you get depends on the console, which is why the same file
"works" for you and not for the next person.

A BOM does not opt you into UTF-8. cmd.exe has no BOM handling for batch files, so
the three BOM bytes are simply the first three characters of the first line. They
fuse onto whatever follows — `@ECHO OFF` becomes `∩╗┐@ECHO OFF` — and the
interpreter reports a command it cannot find. Same 9009, new reason.

This is what makes it expensive to diagnose: both spellings fail with the error
that means "your program is missing", and neither mentions encoding.

## Workaround

Write the file BOM-less and switch the codepage before any line that carries
non-ASCII text:

```bat
@ECHO OFF
chcp 65001 >nul
REM every line below is read as UTF-8
```

Put `chcp` first, above comments as well as commands. Keeping the whole preamble
ASCII costs nothing, and it removes the question of exactly when each line is
decoded — a detail that is easy to get wrong and hard to verify.

The alternative, when you control the content, is to keep the file pure ASCII —
resolve paths at runtime through `%LOCALAPPDATA%` and friends instead of baking
them in as literals.

---

`bom-less-ps1-cp949` is the PowerShell half of this: a `.ps1` without a BOM gets
read in the ANSI codepage. This is the cmd.exe half, and the fix is inverted — a
BOM helps PowerShell 5.1 and actively breaks a batch file.


---


# a batch file saved with Unix line endings makes cmd.exe eat the first byte of lines, so npm becomes pm and powershell becomes hell

## Symptom

A batch script fails with errors naming commands that are not in the file:

```
'pm' is not recognized as an internal or external command
'hell' is not recognized as an internal or external command
```

The file plainly says `call npm install` and `powershell -File ...`. The first
character of the token is gone. Nested `if` and `for` blocks silently do not run,
loops break, and none of it is consistent — the same file can fail differently on
different runs.

There is no encoding error, no syntax error, and no mention of line endings
anywhere in the output.

## Repro

The failure needs `goto` or `call` — a straight-line script usually survives LF.
Build one whose label sits far enough into the file to cross a 512-byte read
boundary:

```powershell
PS> $pad  = ":: " + ("x" * 600)
PS> $body = "@echo off", "goto :main", $pad, ":main", "npm --version"
PS> [IO.File]::WriteAllText("t.cmd", ($body -join [char]10) + [char]10)
PS> Format-Hex t.cmd | Select-String "0D 0A"    # nothing: the file is LF-only
PS> cmd /c t.cmd
```

Rewriting the identical text with CRLF makes it behave:

```powershell
PS> [IO.File]::WriteAllText("t.cmd", ($body -join "\r\n") + "\r\n")
PS> cmd /c t.cmd     # runs
```

What you get from the LF version varies with where the label lands: a label that
is not found, a block that silently does not execute, or a truncated token
reported as a missing command. `npm.cmd` itself uses `goto`, which is why the
reported symptoms name npm.

## Cause

cmd.exe reads a batch file in chunks as it executes rather than parsing it whole,
and it re-seeks whenever control moves — which is exactly what `goto` and `call`
do. The label scanner that performs that seek assumes a two-byte terminator, so on
an LF-only file its arithmetic drifts by one byte per line, and a label that
happens to sit near a chunk boundary is read at the wrong offset.

Straight-line execution mostly tolerates LF, which is why "it worked when I tried
it" is such a common and misleading data point. The failure lives in the seek
path, so it needs a script that jumps — and it appears or disappears when you add
a line anywhere above the label, because that moves where the boundary falls.

That positional sensitivity is what produces the truncated-token symptoms:
resuming at the wrong offset can start mid-word, so `call npm ...` is reported as
`'pm'` and `powershell` as `'hell'`. Nothing announces a line-ending problem.

The modern trigger is new. Batch files used to be written by Windows tools that
emitted CRLF without being asked. Now they are written by editors defaulting to LF
and by AI agents whose file-writing tools emit a bare line feed, so a script shape
that worked for twenty years arrives broken from a generator that never considered
the question.

## Workaround

Write `.cmd` and `.bat` files with CRLF, explicitly:

```js
const body = lines.join("\r\n") + "\r\n";
fs.writeFileSync("run.cmd", body);        // not join("\n")
```

Pin it in `.gitattributes` so a checkout cannot undo it:

```
*.cmd text eol=crlf
*.bat text eol=crlf
```

And scan for it, since the failure never names itself:

```powershell
Get-ChildItem -Filter *.cmd -Recurse | Where-Object {
  -not ([IO.File]::ReadAllBytes($_.FullName) -contains 13)
} | Select-Object FullName    # LF-only batch files
```

PowerShell scripts do not share this — `.ps1` files handle LF fine. It is
specifically the batch interpreter's chunked read and label seek.

## Verification note

The originating report (openclaw#119484) is a user account with the symptoms and
a `Format-Hex` confirmation that the file was LF-only, not an executed
reproduction of the mechanism. The chunk-boundary label-scanner explanation comes
from published analyses of cmd.exe's batch reader rather than from a run in this
loop; this corpus has no Windows host, hence `repro: historical`. What is solidly
established is the remedy: batch files want CRLF, and the symptoms disappear when
they get it.

---

`bomless-bat-oem-codepage` is the other way a batch file can be byte-wrong: there
the encoding is misread, here the line terminator is. Both produce a
"not recognized" error naming something you never wrote, which is why the pair is
worth knowing together.


---


# editing one section of a CRLF file with LF-pure string code leaves a mixed-EOL file that every later diff and hash disagrees about

## Symptom

Your tool edits a config file — injects a section, removes a block, rewrites a
key — and the result looks perfect. Then, days later:

- a diff shows the whole file changed when you touched four lines
- a content hash you store for change detection never matches again
- an idempotent operation is not idempotent; running it twice produces a third
  state
- a block your remove-function knows how to match no longer matches, so removal
  reports success and removes nothing

The file is now half CRLF and half LF, and nothing in your editor shows it.

## Repro

```js
// a config that was written on Windows
const original = "a=1\r\nb=2\r\n";

// an ordinary LF-pure transform: split, insert, join
const lines = original.split("\n");
lines.splice(1, 0, "injected=true");
const result = lines.join("\n");

JSON.stringify(result);
// "a=1\r\ninjected=true\nb=2\r\n"
//        ^^^^ original CRLF   ^^ your new LF
```

Two lines now end differently from their neighbours. Open it in any editor and it
looks identical to what you intended.

## Cause

Nearly all line-oriented string code is LF-pure: it splits on `"\n"`, joins with
`"\n"`, and builds new lines with `"\n"` in template literals. That is correct
for the lines it CREATES and wrong for the file it creates them in, because the
existing lines kept their CRs — `split("\n")` leaves them attached to the ends of
the elements rather than consuming them.

So the transform silently mixes terminators, and each downstream consumer breaks
differently:

- **git** with `core.autocrlf` normalizes on the way in, so the file that looked
  fine locally arrives changed everywhere
- **content hashes** cover bytes, and the bytes moved
- **your own remove-function**, if its pattern is LF-only, will not match the
  block it just wrote in a CRLF context — that is how a removal reports success
  while the block stays in the file and keeps taking effect

The last one is the expensive shape, because the tool tells you the state is one
thing and the file says another.

## Workaround

Normalize at the boundary and restore on write, rather than teaching every
transform about CRLF:

```js
function dominantEol(text) {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  if (crlf === 0) return "\n";
  const bareLf = (text.match(/\n/g) ?? []).length - crlf;
  return crlf >= bareLf ? "\r\n" : "\n";
}

function applyEol(text, eol) {
  const lf = text.replace(/\r\n/g, "\n");
  return eol === "\n" ? lf : lf.replace(/\n/g, "\r\n");
}

const raw = readFileSync(path, "utf8");
const eol = dominantEol(raw);                 // measure BEFORE touching anything
let content = applyEol(raw, "\n");            // LF-pure interior
content = yourExistingTransforms(content);    // unchanged
writeFileSync(path, applyEol(content, eol));  // restore on the way out
```

Two details worth keeping. Measure the dominant ending from the ORIGINAL bytes,
not after any transform, or a file that was already mixed drifts further each
run. And if you hash for change detection, hash the FINAL bytes you wrote — a
hash of the LF interior will never match the file on disk.

Any pattern that matches a line you wrote earlier needs `\r?` for the same
reason: `/^# BEGIN block$/m` does not match `# BEGIN block\r`.

---

`split-n-leaves-cr` is the read side of this mechanism: a CR survives into a
comparison and a match fails. This is the write side — the CRs you did not
consume stay in the file and the ones you add are missing, so the artifact itself
becomes inconsistent.


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


---


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


---


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


---


# splitting on newline leaves an invisible carriage return, so the line that closes your parser never matches

## Symptom

A line parser that works on every file you wrote yourself silently mis-parses a
file that came from Windows. The classic shape is a delimiter that never closes:
a code fence, a heredoc, a BEGIN/END block, a front-matter `---`. Everything after
the opening delimiter is swallowed into a region that was supposed to end three
lines later.

Nothing errors. The text is right there in your editor, the closing line looks
identical to the one you are matching, and `console.log` prints it back looking
correct. Diff views, terminals, and log aggregators all render CR as nothing.

## Repro

````js
const text = "BEGIN\r\nbody\r\nEND\r\nafter";
const lines = text.split("\n");
lines[0] === "BEGIN";        // false  <- the block never opens
JSON.stringify(lines[0]);    // '"BEGIN\r"'
````

Same shape in Python:

```python
"a\r\nb".split("\n")[0] == "a"   # False
```

And the anchored-regex version, which fools people who thought they had escaped it:

````js
/^BEGIN$/.test(lines[0])     // false — $ matches before \n, not before \r
````

You get CRLF input without asking: git with `core.autocrlf=true` checks files out
that way, Notepad writes it, `Set-Content` and `Out-File` write it, and every
Windows process that prints line-by-line emits it.

## Cause

Windows terminates lines with CRLF; POSIX with LF alone. Splitting on `"\n"`
consumes only the LF, so the CR stays glued to the end of the preceding element.
Every downstream exact comparison then fails against a character with no glyph.

Regex `$` does not save you. In JavaScript multiline mode and in Python, `$`
matches before a trailing newline — not before a trailing CR — so `/^x$/` is false
for `"x\r"` in exactly the same way `=== "x"` is.

This is why the bug survives review: the failing value is invisible in every
medium a reviewer looks at. It shows up only under `JSON.stringify`, `cat -A`,
`xxd`, or an editor with "show invisibles" turned on.

## Workaround

Split on the line break, not on the newline character:

```js
const lines = text.split(/\r?\n/);
```

If you must keep `split("\n")` — because you are streaming, or the offsets matter —
make every terminator-sensitive pattern tolerate the residue:

````js
/^ *\r?$/.test(rest)                  // blank-line check
/^(`{3,})([ \t]*\r?)$/.exec(line)     // fence close
````

Python's `str.splitlines()` and Go's `bufio.Scanner` handle both terminators
already. Reading a file as text with a runtime that normalizes is fine; the trap
is specifically hand-rolled splitting on `"\n"`.

---

The corpus's other encoding cases are about how bytes are *written* — BOMs,
UTF-16, the CP949 codepage. This one is about how they are *cut*: the encoding is
fine, the file is valid, and one invisible byte per line breaks equality.


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
