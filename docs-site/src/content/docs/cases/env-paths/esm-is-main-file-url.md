---
title: "the is-main guard built by concatenating file:// with argv[1] can never be true on Windows, so your CLI exits 0 doing nothing"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "esm is main file url"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#win32-path-normalization">win32-path-normalization</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, bun, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">win32 path normalization</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">realpath both sides</span></span></div></div>

## Symptom

A dual-purpose ESM module — importable as a library, runnable as a CLI — runs on
Windows, prints nothing, and exits 0. No error, no stack, no usage text. It works
on macOS and Linux.

The guard looks correct and is the shape half the ecosystem copied out of CommonJS
`require.main === module`:

```js
const isDirect = process.argv[1] !== undefined
  && import.meta.url === `file://${process.argv[1]}`;
if (isDirect) main(process.argv.slice(2));
```

On Windows that comparison is false for every possible invocation. `main()` is
never called, so the process falls off the end of the module and exits cleanly.
Exit code 0 is the worst part: every wrapper, CI step, and installer treats it as
success.

## Repro

```js
// whoami.mjs
console.log("meta:", import.meta.url);
console.log("argv:", process.argv[1]);
console.log("equal:", import.meta.url === `file://${process.argv[1]}`);
```

```
PS> node whoami.mjs
meta: file:///D:/work/whoami.mjs
argv: D:\work\whoami.mjs
equal: False
```

```
$ node whoami.mjs        # macOS / Linux
meta: file:///home/u/whoami.mjs
argv: /home/u/whoami.mjs
equal: true
```

The POSIX case works by coincidence: an absolute POSIX path starts with `/`, so
`"file://" + "/home/u/x.mjs"` accidentally produces the correct three-slash URL.

## Cause

`import.meta.url` is a real `file:` URL. A Windows one is
`file:///D:/work/whoami.mjs`: three slashes, a drive letter, forward slashes, and
percent-encoding for anything non-ASCII. `process.argv[1]` is a plain Win32 path,
`D:\work\whoami.mjs`. Concatenation produces `file://D:\work\whoami.mjs`, which
differs in the slash count, the separator direction, and the encoding — three
independent reasons the strings cannot match.

A space in the path breaks it a fourth way (`%20` in the URL, a literal space in
argv), and on a case-differing drive letter a fifth.

The adjacent trap, which bites on every OS: even a correctly built URL compares
unequal when the script is reached through a symlink, because `import.meta.url`
reports the realpath while `argv[1]` preserves the link. That is how npm global
bins and plugin caches invoke things, so a guard can pass your local test and skip
`main()` for every installed user.

## Workaround

Compare resolved paths, not strings, and resolve both sides:

```js
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const isDirect = (() => {
  try {
    if (process.argv[1] === undefined) return false;
    const self = realpathSync(fileURLToPath(import.meta.url));
    let invoked = process.argv[1];
    try { invoked = realpathSync(invoked); } catch { /* keep unresolved */ }
    return self === invoked;
  } catch { return false; }
})();
```

`fileURLToPath` handles the drive letter, the slashes, and the percent-decoding.
The `realpathSync` pair handles the symlink. On Node 20.11+ and Bun, `import.meta.main`
does all of this for you and is the right answer when you can require that version.

Never reach for `import.meta.url.endsWith(basename)` as the quick fix: it fires for
any file with the same name anywhere on the machine.

---

Worth its own entry because the failure is silent and exit-0. The corpus's other
path traps are about *finding* things — `node-path-host-delimiter` is the PATH-list
separator, `pathext-bare-name-enoent` is extension resolution. This one is about
*identity*: two spellings of the same file that Windows makes unequal.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/19>
- <https://github.com/lidge-jun/codexclaw/commit/319371421bb9034756f68f99a406f85cd2694dda>
