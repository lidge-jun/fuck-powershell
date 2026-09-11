---
title: "dynamic import of an absolute path works on POSIX and throws ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows, because C: reads as a protocol"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "dynamic import needs file url"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#drive-letter-as-scheme">drive-letter-as-scheme</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, bun, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">INVALID URL SCHEME</span></div><div class="row"><span class="k">Mechanism</span><span class="v">drive letter as scheme</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">pathtofileurl</span></span></div></div>

# dynamic import of an absolute path works on POSIX and throws ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows, because C: reads as a protocol

## Symptom

Code that loads a module computed at runtime — a plugin, a generated file, a test
fixture — runs everywhere and dies only on Windows:

```
TypeError [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in:
file, data, and node are supported by the default ESM loader.
On Windows, absolute paths must be valid file:// URLs.
Received protocol 'd:'
```

The message is unusually good — it tells you the fix — but it arrives at runtime,
in whatever code path builds the specifier, which is often a rarely exercised one.

## Repro

```js
import { resolve } from "node:path";
const file = resolve("plugin.mjs");
await import(file);
```

```
PS> node load.mjs
TypeError [ERR_UNSUPPORTED_ESM_URL_SCHEME]: ... Received protocol 'd:'
```

```
$ node load.mjs      # macOS / Linux — loads fine
```

## Cause

`import()` takes a URL, not a path. It accepts a bare relative specifier, and it
accepts a `file:` URL. An absolute POSIX path happens to work as a third case
because `/home/u/x.mjs` parses as a root-relative URL.

An absolute Windows path does not get that coincidence. `D:\work\x.mjs` parses as
a URL whose scheme is `d:`, and the ESM loader supports `file:`, `data:`, and
`node:` only. The drive letter, the thing that makes the path absolute, is exactly
what makes it an unsupported protocol.

Two adjacent traps in the same family:

- `require()` accepts absolute paths on both platforms, so code converted from
  CommonJS to ESM acquires this bug at the moment of conversion.
- A cache-busting query string (`${file}?v=${Date.now()}`) makes the specifier
  even more URL-shaped without fixing the scheme, so it fails identically.

## Workaround

Convert with the function built for it:

```js
import { pathToFileURL } from "node:url";
await import(pathToFileURL(file).href);
```

`pathToFileURL` also percent-encodes characters that are legal in a path and
special in a URL — `#`, `?`, and spaces — which manual `"file://" + path` string
building silently gets wrong. Never hand-build the URL; the three-slash form,
the drive letter, and the encoding all have to be right at once.

If you keep a cache-buster, append it to the `href`, after the conversion.

---

`esm-is-main-file-url` is this trap's mirror image: there, code builds a URL from
a path by concatenation and the comparison silently fails. Here, code passes a
path where a URL is required and the loader refuses loudly. Same underlying
confusion, opposite failure mode.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/27>
- <https://github.com/lidge-jun/ima2-gen/commit/0a18d552a>
