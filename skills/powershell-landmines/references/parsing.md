
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
