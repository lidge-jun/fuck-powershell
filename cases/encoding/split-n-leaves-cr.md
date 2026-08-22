---
id: split-n-leaves-cr
title: "splitting on newline leaves an invisible carriage return, so the line that closes your parser never matches"
category: encoding
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/codexclaw/commit/2c3801a1bf2a72aa83cdbf15a71fd0fbf224de25
ontology:
  affects: [runtime-node, runtime-bun, runtime-python, env-windows]
  caused_by: [mechanism-crlf-residue]
  mitigated_by: [workaround-crlf-tolerant-split]
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
