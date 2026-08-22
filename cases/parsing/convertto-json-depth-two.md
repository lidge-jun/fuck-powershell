---
id: convertto-json-depth-two
title: "ConvertTo-Json defaults to -Depth 2 and replaces your data with the string System.Collections.Hashtable"
category: parsing
versions: "both"
failure: silent
context: [ci, script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/15
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
