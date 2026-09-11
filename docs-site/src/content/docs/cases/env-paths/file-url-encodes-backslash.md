---
title: "building a file URL with a URL library percent-encodes the backslashes, so the database that exists cannot be opened"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "file url encodes backslash"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#separator-as-url-data">separator-as-url-data</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, python</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">separator as url data</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">normalize before url</span></span></div></div>

# building a file URL with a URL library percent-encodes the backslashes, so the database that exists cannot be opened

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

```go
u := url.URL{Scheme: "file", Path: `C:\Users\me\state.sqlite`}
u.String()   // file:C:%5CUsers%5Cme%5Cstate.sqlite
```

And the POSIX input that hides it, because it needs no conversion:

```go
u := url.URL{Scheme: "file", Path: "/home/me/state.sqlite"}
u.String()   // file:///home/me/state.sqlite
```

Which library you use decides whether you meet this at all. Checked on Node
v24.17.0:

```js
const u = new URL("file:");
u.pathname = "C:\\Users\\me\\state.sqlite";
u.href;   // "file:///C:/Users/me/state.sqlite" — WHATWG converts it for you
```

That is not a reason to relax. It means the same logic is correct in one language
and broken in another, so a port, a rewrite, or a second service in a different
stack acquires the bug silently.

## Cause

A backslash is an ordinary character in a URL path, not a separator, so a
general-purpose URL type percent-encodes it as data. Go's `net/url` does exactly
that, and it is right to: it was handed a string that was never a URL path.

The WHATWG URL standard carves out an exception — for special schemes, `file:`
among them, a backslash is treated as a forward slash — which is why browser-shaped
implementations like Node's `URL` quietly do the right thing. Go's `net/url`,
Python's `urllib.parse.urlunparse`, and most DSN builders follow the RFC rather
than that living standard, so they do not.

Two things have to happen for a Windows path to become a valid file URL, and a
generic builder does neither:

1. Separators must be converted to forward slashes BEFORE the value reaches the
   URL type, or they are encoded as data.
2. A drive-absolute path needs a leading slash, because `file:` plus `C:/...`
   yields two slashes where the form wants three. `file:///C:/...` is correct.

## Workaround

Use the purpose-built conversion when your runtime has one — Node's
`pathToFileURL` and Python's `pathlib.Path.as_uri()` both produce the correct
form, including percent-encoding characters that are legal in a path and special
in a URL:

```js
const { pathToFileURL } = require("node:url");
pathToFileURL("C:\\Users\\me\\state.sqlite").href;
// "file:///C:/Users/me/state.sqlite"
```

When the target is a DSN rather than a plain URL — a SQLite connection string with
query parameters, say — normalize first and build second:

```go
normalized := strings.ReplaceAll(path, `\`, "/")
if len(normalized) >= 2 && normalized[1] == ':' {
    normalized = "/" + normalized          // file:///C:/...
}
u := url.URL{Scheme: "file", Path: normalized}
```

Then assert on the result in a test: a DSN containing `%5C` is always wrong, and
that one check catches every future call site — including the one someone adds
next year in a different language.

---

`dynamic-import-needs-file-url` is the loud version of the same confusion, where
a loader refuses a path outright because the drive letter reads as a protocol.
This is the quiet version, and a different mechanism underneath: nothing is
refused, the conversion succeeds, and the separators simply become data.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/38>
- <https://github.com/lidge-jun/opencodex/commit/753c3231ad196b8499866feae8ccd7811177246c>
