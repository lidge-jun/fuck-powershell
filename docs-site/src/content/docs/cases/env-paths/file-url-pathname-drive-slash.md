---
title: "new URL(...).pathname of a file: URL is '/D:/a/...' on Windows, so bun and node cannot open the script you just resolved"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "file url pathname drive slash"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#file-url-scheme-path">file-url-scheme-path</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, bun</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT, EXIT CODE LEAK</span></div><div class="row"><span class="k">Mechanism</span><span class="v">file url scheme path</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">file url to path</span></span></div></div>

## Symptom

A test that spawns a sibling CLI script exits 1 on Windows only, and the assertion that catches
it says nothing useful:

```
(fail) dev version bump rule > the CLI rewrites only the version line
error: expect(received).toBe(expected)
Expected: 0
Received: 1
```

Worse, the case that expected a nonzero exit for malformed input stayed green: it read the
load failure as a correct rejection. Three real cases red, one false green, no message.

## Repro

```js
// tests/x.test.ts
const CLI = new URL("../scripts/tool.ts", import.meta.url).pathname;
console.log(CLI);
Bun.spawnSync(["bun", CLI]).exitCode;   // 1 on Windows
```

```powershell
PS> bun test x.test.ts
/D:/a/repo/scripts/tool.ts
```

`node` behaves the same: `error: Cannot find module '/D:/a/repo/scripts/tool.ts'`.

## Cause

A `file:` URL on Windows is `file:///D:/a/repo/scripts/tool.ts`. The URL's `pathname` is
everything after the authority, so it starts with a slash and the drive letter is just the
first path segment: `/D:/a/repo/...`. That is a valid URL path and an invalid Windows path.
On POSIX the two representations coincide, which is why the shortcut survives every other
platform.

`import.meta.url`, `import.meta.resolve`, and `new URL(specifier, base)` all produce URLs;
they are not paths. Only `fileURLToPath` performs the conversion, and it also decodes
percent-escapes (`%20`) that `pathname` would leave in place.

## Workaround

```ts
import { fileURLToPath } from "node:url";
const CLI = fileURLToPath(new URL("../scripts/tool.ts", import.meta.url));
Bun.spawnSync([process.execPath, CLI, ...args]);
```

Two habits close the false-green gap too: include the child's stderr in the assertion message
so an exit code comes with its reason, and assert the specific rejection text in negative
cases rather than "any nonzero exit".

Sibling cases: `file-url-encodes-backslash` (the reverse conversion), `esm-is-main-file-url`
and `dynamic-import-needs-file-url` (where a path must become a URL).

## Refs

- <https://github.com/lidge-jun/opencodex/actions/runs/33590540220>
