---
id: dynamic-import-needs-file-url
title: "dynamic import of an absolute path works on POSIX and throws ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows, because C: reads as a protocol"
category: env-paths
versions: "both"
failure: hard-error
context: [script, ci, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/ima2-gen/commit/0a18d552a
ontology:
  affects: [runtime-node, runtime-bun, env-windows]
  invokes: [command-node]
  manifests_as: [error-invalid-url-scheme]
  caused_by: [mechanism-drive-letter-as-scheme]
  mitigated_by: [workaround-pathtofileurl]
---

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
