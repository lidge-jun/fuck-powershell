
# backslashes vanish from typed paths on German keyboards, because the terminal reports AltGr as Ctrl+Alt and your keybinding ate it

## Symptom

A user types a Windows path into your TUI and characters silently disappear:

```
typed:  C:\Users\Admin
got:    C:UsersAdmin
```

No error, no beep, no indication anything was dropped. The user retypes it,
watches carefully, and it happens again. On your machine it never reproduces.

The difference is the keyboard layout. On US and UK layouts backslash is a plain
key. On German, French, Polish and many others it requires AltGr.

## Repro

In any terminal input handler, log the raw key events while a German-layout user
types `\`:

```
KeyEvent { code: Char('\\'), modifiers: CONTROL | ALT }
```

Then look at your own dispatch:

```rust
if modifiers.contains(CONTROL) {
    return self.handle_binding(code);   // <- swallows it
}
self.insert_char(code);
```

The character never reaches the insert path, because a reasonable-looking guard
treated a modified key as a command.

## Cause

AltGr is not a distinct modifier on Windows. It is implemented as
**right Alt = Ctrl + Alt**, and terminals report the chord that way, so a
character produced by AltGr arrives with both CONTROL and ALT set.

That collides directly with the near-universal convention that Ctrl-modified keys
are shortcuts rather than text. Any handler shaped like "if Ctrl is held, this is
a binding" silently eats real characters — but only for layouts that need AltGr to
produce them.

Which characters are affected is layout-dependent, and the list is exactly the
ones that matter for developers: `\`, `@`, `{`, `}`, `[`, `]`, `|`, `~`, `€`.
On a German layout, both the backslash in a path and the pipe in a shell command
come through AltGr.

This is why it survives review: the bug is invisible on the layout every reviewer
is using, and the symptom — a path that is missing separators — looks like a
string-handling bug anywhere except the input layer.

## Workaround

Treat a Ctrl+Alt chord that carries a printable character as literal input, and
reserve bindings for Ctrl-alone:

```rust
let is_altgr = modifiers.contains(CONTROL) && modifiers.contains(ALT);
if let Char(c) = code {
    if is_altgr || !modifiers.contains(CONTROL) {
        self.insert_char(c);
        return;
    }
}
self.handle_binding(code, modifiers);
```

The cost is that genuine Ctrl+Alt+key shortcuts become unavailable — which is the
right trade, because those were never safe to bind on Windows for exactly this
reason.

Test with a non-US layout, or at minimum with a synthetic
`CONTROL | ALT | Char('\\')` event. A US-layout keyboard cannot produce the
failing input at all, so no amount of manual testing on one finds it.

---

The corpus's other input-layer cases are about how a shell re-parses text after
you send it. This one is earlier: the character never became text, because a
modifier convention that is safe on POSIX terminals is not safe on Windows.


---


# your allowlist matches on a basename computed with split slash, so every Windows client silently bypasses it

## Symptom

A filter works. You tested it, the tests pass, and it does nothing for a subset
of your users — the ones on Windows. Blocklists do not block, allowlists do not
allow, caches never hit, and routing sends things to the wrong place.

There is no error, because a basename computation cannot fail. It just returns
the wrong string, and the comparison that follows honestly reports no match.

The version that cost real money: a server elided oversized skill bundles by
matching the directory basename against a blocklist. Windows clients sent
`C:\Users\me\.claude\skills\claude-api`, the basename came out as the whole
path, nothing matched, and 790,000-character bundles went to a metered model.

## Repro

```js
const dir = "C:\\Users\\me\\.claude\\skills\\claude-api";

dir.split("/").filter(Boolean).pop();
// "C:\Users\me\.claude\skills\claude-api"   <- the entire path

blocked.includes(that);   // false, forever
```

The POSIX input works, which is why this ships:

```js
"/home/me/.claude/skills/claude-api".split("/").pop();   // "claude-api"
```

## Cause

`split("/")` on a backslash-separated path finds no separators, so it returns a
one-element array and `.pop()` hands back the input unchanged. Every subsequent
string operation is then comparing a full path against a bare name.

This is specifically a hazard for paths that arrive as DATA rather than being
built locally: a request body, a config value, a manifest entry, a log line. Code
that builds paths with `path.join` gets the host's separator and stays consistent
with itself; code that receives a path from a client gets the CLIENT's separator,
and on a POSIX server that is the one separator your local tests never produce.

`path.basename` does not save you here either. The POSIX build of it — which is
what `node:path` gives you on a Linux server — treats backslash as an ordinary
filename character, so it returns the same wrong answer as the manual split.

Three variants to expect in the same input: backslash (`C:\a\b`), mixed
(`C:/a\b`), and UNC (`\\\\server\\share\\b`).

## Workaround

Normalize separators before you split, at the point the untrusted path enters:

```js
const base = dir.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
```

If both separators are possible and you want the platform-correct answer, use
`path.win32.basename` explicitly for client-supplied Windows paths rather than
the ambient `path.basename`, whose behavior depends on where your server happens
to run.

And when a security or cost decision depends on the result, add a test with a
backslash path. This class of bug is invisible to every fixture written by
someone on a Mac.

---

`zip-entry-drive-letter-escapes` is the same blindness pointed at absoluteness
rather than at the basename: POSIX path logic applied to a Windows path that a
Windows API will happily honor.


---


# ConvertTo-Json defaults to -Depth 2 and replaces your data with the string System.Collections.Hashtable

## Symptom

You serialize a config and ship it. The JSON is well-formed, every consumer
parses it happily, and a chunk of your data has been replaced by the **name of a
.NET type**.

```powershell
$config = @{
  name = "svc"
  deploy = @{ staging = @{ env = @{ DB_URL = "postgres://staging"; API_KEY = "s-123" } } }
}
$config | ConvertTo-Json -Compress
```

```json
{"deploy":{"staging":{"env":"System.Collections.Hashtable"}},"name":"svc"}
```

The database URL and the API key are gone. No error, no warning, exit code 0.

## Repro

```powershell
@{a=@{b=@{c="ok"}}}       | ConvertTo-Json -Compress
# {"a":{"b":{"c":"ok"}}}                                  depth 3: fine

@{a=@{b=@{c=@{d="ok"}}}}  | ConvertTo-Json -Compress
# {"a":{"b":{"c":"System.Collections.Hashtable"}}}         depth 4: destroyed
```

Confirmed silent — nothing is written to the error stream:

```powershell
$out = $d4 | ConvertTo-Json -Compress 2>&1
@($out | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }).Count
# 0
```

## Cause

`ConvertTo-Json` has a default `-Depth` of **2**. Anything nested deeper is not
truncated or omitted — it is rendered with `.ToString()`, and the `.ToString()`
of a hashtable is its type name.

That detail is what makes this so much worse than a normal truncation bug:

- The output is **still valid JSON**, so schema-less consumers accept it.
- The lost value is replaced by a **plausible-looking string**, so a spot check
  reads as "some field I don't recognise" rather than "data loss".
- Nothing is emitted on stderr, so CI stays green.

Three lines of nesting is not exotic. `config -> environment -> variables` hits
it, and so does almost any real deployment descriptor.

## Workaround

```powershell
$config | ConvertTo-Json -Compress -Depth 10
# {"deploy":{"staging":{"env":{"DB_URL":"postgres://staging","API_KEY":"s-123"}}}}
```

Pass `-Depth` **every time**, generously. There is no way to make the default
safe, and no warning to tell you the default was insufficient.

In CI, assert the round-trip rather than trusting the writer:

```powershell
$json = $config | ConvertTo-Json -Depth 20 -Compress
if ($json -match 'System\.Collections') { throw "ConvertTo-Json depth truncation" }
```

## Two adjacent surprises found in the same probe

**Hashtable key order is not insertion order.**

```powershell
$h = @{b=2; a=1; c=3}; $h.Keys -join ","
# c,a,b
```

So serialized output is not byte-stable across runs, which breaks diffing and
content hashing. Use `[ordered]@{}` when the order matters.

**`ConvertFrom-Json` does not give you back a hashtable.**

```powershell
('{"a":1}' | ConvertFrom-Json).GetType().Name
# PSCustomObject
```

So `.ContainsKey()` does not exist on the parsed result, and a serialize/parse
round trip does not return the type you started with.

---

The archive touches `ConvertFrom-Json` once, in `strictmode-missing-property`,
which is about reading a field that is absent. Nothing covers the writing side,
where the field is present in memory and destroyed on the way out.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11.


---


# casting a comma-decimal string gives a number 100x too large, with no error

## Symptom

A European-formatted decimal casts to a number **one hundred times too large**,
with no error and no warning.

```powershell
[double]"3,14"        # 314
[double]"3,14159"     # 314159        <- off by a factor of 100,000
```

This is not a parse failure that you can catch. It is a successful parse of a
different number.

## Repro

```powershell
[double]"1,5"         # 15
[double]"1,50"        # 150
[double]"1,500"       # 1500
[int]"1,234"          # 1234
[decimal]"2,5"        # 25
```

Every numeric type does it. Note `"1,500"` -> `1500` is *correct* under the
thousands-separator reading, which is exactly why the behaviour exists — and
exactly why `"1,5"` -> `15` sails through the same code path.

## Cause

PowerShell's numeric casts accept group separators. Under `en-US`, `,` is the
thousands separator, so `"3,14"` is read as "three thousand fourteen with a
stray grouping" and normalized to `314`.

Any locale that writes decimals with a comma — most of Europe, much of South
America — produces data that this reads as a different magnitude. CSV exports,
API responses from localized services, and user input are all common sources.

## `InvariantCulture` does not save you

The instinct is to reach for an explicit culture. It does not help:

```powershell
[double]::Parse("3,14", [System.Globalization.CultureInfo]::InvariantCulture)
# 314        <- still wrong, still no exception
```

`InvariantCulture` uses `.` for decimals and `,` for grouping, so it agrees
with the wrong reading. Picking a culture changes *which* separator means what;
it does not make the parse strict.

## Workaround

The only reliable fix is to reject group separators explicitly, via a
`NumberStyles` that excludes `AllowThousands`:

```powershell
[double]::Parse("3.14",
                [System.Globalization.NumberStyles]::Float,
                [System.Globalization.CultureInfo]::InvariantCulture)
# 3.14
```

`NumberStyles::Float` is `AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign |
AllowDecimalPoint | AllowExponent` — notably **without** `AllowThousands`, so a
comma now throws instead of being absorbed.

Practical rules:

- Validate the *string* before casting when it comes from data:
  `if ($s -notmatch '^-?\d+(\.\d+)?$') { throw }`
- Never use `[double]$x` on untrusted input.
- If you must accept both conventions, decide explicitly which one the source
  uses rather than letting the cast guess.

## Why this is worth filing

Nothing in the archive covers culture or numeric parsing. And unlike most
entries here, the damage is **numerically plausible** — `314` looks like a real
measurement, so it flows through validation, gets stored, and shows up as a
quantity, price or threshold that is wrong by orders of magnitude.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, culture
`en-US`. The behaviour is separator-driven, not host-locale-driven — an en-US
host mangles comma-decimal data exactly as shown above.


---


# parsing schtasks or sc output works until the machine is not English, because Windows tools translate their column headings and status words

## Symptom

A status check that reads a built-in Windows tool's output reports the wrong
thing on a machine whose system language is not English. The service is
installed and your code says it is not; the task is running and your code decides
it is stale and reinstalls it — writing the same definition that failed the same
comparison, so the loop never terminates.

Nothing throws. Text was searched for a substring, the substring was not there,
and the absence was read as a fact about the system.

## Repro

On an English machine:

```
C:\> schtasks /Query /TN MyTask /FO LIST
TaskName:      \MyTask
Status:        Ready
```

On a Korean one, same task, same command:

```
C:\> schtasks /Query /TN MyTask /FO LIST
작업 이름:     \MyTask
상태:          준비
```

So the check inverts:

```js
out.includes("Ready")        // true on en-US, false everywhere else
out.includes("Running")      // same
```

`sc query`, `net`, `tasklist`, and `icacls` all localize the same way, and their
error text localizes too — so error CLASSIFICATION by message matching fails in
the same places.

## Cause

Windows built-in command-line tools are localized: the headings, the state words,
and the error messages are all translated to the system UI language. Only the
structure and the exit code are stable.

That makes any `includes("Ready")` a test of the machine's language rather than
of its state, and English is the one language where the bug is invisible.

There is a second, subtler version of this that survives translation: encoding
round-trips. Task Scheduler exports task XML with its own entity encoding, so a
needle you escaped yourself (`&quot;`) never matches the literal `"` the export
contains. Same failure shape — two spellings of one value compared as strings —
and it is permanent rather than locale-dependent.

## Workaround

Ask for structured output and parse the structure, not the prose:

```
schtasks /Query /TN MyTask /XML        # XML, element names are not translated
sc.exe query MyService                 # exit code 1060 = does not exist
Get-ScheduledTask -TaskName MyTask     # PowerShell objects, typed .State enum
```

Prefer, in order: an exit code, a typed object from a PowerShell cmdlet, XML or
JSON element names, and only then text. When you must compare XML values, decode
entities on both sides exactly once before comparing — and decode once, not
repeatedly, so `&amp;quot;` cannot impersonate a quote.

For liveness, do not parse a tool's opinion at all: check the thing itself. An
identity-verified probe of your own process answers the real question and is
immune to every translation.

Keep localized text out of user-facing output too. Echoing a decoded-wrong,
locale-specific line back to a user turns one bug into two.

---

`env-domain-principal` is the identity version of this mistake: trusting an
environment-derived string instead of resolving the real principal. This is the
output version — trusting a tool's prose instead of its structure.


---


# your zip extractor rejects ../ and still writes to C:/Windows, because a drive letter is absolute without a leading slash

## Symptom

There is no symptom until someone uses it. A path guard that reads as thorough —
it strips `..`, it rejects paths starting with `/` — writes an archive entry
outside its destination on Windows and nowhere else.

The guard looks like this, and it is wrong in two independent ways:

```js
if (name.startsWith("..") || name.startsWith("/")) continue;   // "safe"
```

## Repro

```js
const path = require("node:path");

// 1. a drive-letter entry is absolute, and passes both checks
const a = "C:/Windows/System32/drivers/etc/hosts";
a.startsWith("..") || a.startsWith("/");   // false — allowed through
path.posix.isAbsolute(a);                  // false — the POSIX check agrees
path.win32.isAbsolute(a);                  // true  — only win32 knows

// 2. a nested traversal survives a prefix check
const b = "safe/../../evil.md";
b.startsWith("..");                        // false — allowed through
path.posix.normalize(b);                   // "../evil.md" — it escapes
```

And the drive-relative form, which is stranger still:

```js
path.win32.resolve("C:evil.txt");   // resolves against the CWD *of drive C*,
                                    // which is per-drive state, not your cwd
```

## Cause

"Absolute" is not one concept. On POSIX a path is absolute exactly when it starts
with `/`, so a single prefix check is a complete test. Windows has three
absolute-ish forms and only one of them starts with a separator:

- `C:\dir\file` — drive-absolute
- `C:file` — drive-RELATIVE, resolved against a per-drive current directory
- `\\server\share\file` — UNC

`path.posix.isAbsolute` is false for all three, and a Node program that normalizes
archive entries with `path.posix` — the sensible choice, since zip entry names use
forward slashes by spec — inherits that blindness. The file is then written with a
Win32 API that honors the drive letter perfectly well.

The second half is that prefix checks and normalization are different operations.
`safe/../../evil.md` does not start with `..`; it becomes `../evil.md` only after
you normalize it. Checking before normalizing tests a string that will not be the
one used.

## Workaround

Normalize first, then reject on the normalized value, and add the Windows forms
the POSIX check cannot see:

```js
function safeEntryName(entry) {
  const raw = String(entry).replace(/\\/g, "/");
  const normalized = path.posix.normalize(raw);
  if (
    raw.split("/").includes("..") ||          // no raw traversal segment at all
    normalized === "." || normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:(?:\/|$)/.test(normalized)     // C:/ and bare C:
  ) return null;
  return normalized;
}
```

Rejecting any raw `..` segment — even one that normalizes away, like
`safe/../x` — costs you nothing in a context you control and removes a whole
class of normalization-order bugs.

The belt-and-braces version, worth it when the archive is untrusted: resolve the
final path and verify it is still inside the destination with
`path.relative(dest, resolved)`, checking that the result neither starts with
`..` nor is absolute. That catches forms nobody enumerated.

---

`path-colon-not-delimiter` is the other half of the colon problem: code that
splits a PATH-like string on `:` cuts drive letters in half. Here the colon is
not being split on but being ignored, and the result is a write outside the
sandbox.
