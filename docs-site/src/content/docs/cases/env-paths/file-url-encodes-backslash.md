---
title: "building a file URL with a URL library percent-encodes the backslashes, so the database that exists cannot be opened"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "file url encodes backslash"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#drive-letter-as-scheme">drive-letter-as-scheme</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, python</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">drive letter as scheme</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">normalize before url</span></span></div></div>

## Symptom

A connection string built from a real path fails on Windows and only on Windows.
SQLite says the file is missing; the file is right there.

```
unable to open database file
```

Printing the DSN shows why, once you look closely:

```
file:C%3A%5CUsers%5Cme%5Cstate.sqlite?mode=ro
```

Every separator is `%5C` and the drive colon is `%3A`. The URL is well-formed and
points nowhere.

## Repro

```js
const u = new URL("file:");
u.pathname = "C:\\Users\\me\\state.sqlite";
u.href;                       // "file:///C%3A%5CUsers%5Cme%5Cstate.sqlite"
```

Same shape in Go and Python, because they are all doing the correct thing:

```go
u := url.URL{Scheme: "file", Path: `C:\Users\me\state.sqlite`}
u.String()   // file:C:%5CUsers%5Cme%5Cstate.sqlite
```

And the POSIX case that hides it:

```js
u.pathname = "/home/me/state.sqlite";
u.href;      // "file:///home/me/state.sqlite"  — correct by coincidence
```

## Cause

A backslash is an ordinary character in a URL path, not a separator, so any
conforming URL builder percent-encodes it. The library is right; the input was
never a URL path.

Two things have to happen for a Windows path to become a valid file URL, and a
generic builder does neither:

1. Separators must be converted to forward slashes BEFORE the value is handed to
   the URL type, otherwise they get encoded as data.
2. A drive-absolute path needs a leading slash, because `file:` plus `C:/...`
   yields two slashes where the spec wants three. `file:///C:/...` is the correct
   form.

A POSIX absolute path already starts with `/` and contains no backslashes, so it
passes through untouched and the bug never appears in development.

## Workaround

Use the runtime's dedicated conversion when there is one:

```js
const { pathToFileURL } = require("node:url");
pathToFileURL("C:\\Users\\me\\state.sqlite").href;
// "file:///C:/Users/me/state.sqlite"
```

When the target is a DSN rather than a plain URL — a SQLite connection string with
query parameters, say — normalize first and build second:

```go
normalized := strings.ReplaceAll(path, `\\`, "/")
if len(normalized) >= 2 && normalized[1] == ':' {
    normalized = "/" + normalized          // file:///C:/...
}
u := url.URL{Scheme: "file", Path: normalized}
```

Then assert on the result in a test: a DSN containing `%5C` is always wrong, and
that one check catches every future call site.

---

`dynamic-import-needs-file-url` is the loud version of the same confusion, where
a loader refuses the path outright. This is the quiet version: the conversion
succeeds, produces a syntactically valid URL, and the failure surfaces as a
missing file somewhere else entirely.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/38>
- <https://github.com/lidge-jun/opencodex/commit/753c3231ad196b8499866feae8ccd7811177246c>
