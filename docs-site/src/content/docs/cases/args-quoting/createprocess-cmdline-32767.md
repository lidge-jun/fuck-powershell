---
title: "os error 206 says the filename is too long when the filename is fine — the command line hit the 32,767-character cap"
description: "args-quoting landmine — misleading-error (both)"
sidebar:
  label: "createprocess cmdline 32767"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#command-line-cap">command-line-cap</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, win32 api, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENAMETOOLONG</span></div><div class="row"><span class="k">Mechanism</span><span class="v">command line cap</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">payload off argv</span></span></div></div>

# os error 206 says the filename is too long when the filename is fine — the command line hit the 32,767-character cap

## Symptom

A spawn fails with an error about filenames, naming a path that is nowhere near
too long:

```
failed to launch helper: helper=C:\Program Files\app\helper.exe
error=The filename or extension is too long. (os error 206)
```

You check the path. It is 40 characters. You check MAX_PATH, enable long paths,
set the registry key, and nothing changes — because the path was never the
problem.

What makes it hard is the correlation: the failure appears on ONE machine and
scales with something unrelated to your code. In the reported case it grew with
the number of loose files in the user's profile directory, because the payload
being passed enumerated them.

## Repro

```js
const { spawnSync } = require("node:child_process");
const payload = "x".repeat(40000);
const r = spawnSync("cmd.exe", ["/c", "echo", payload]);
r.error.code;      // ENAMETOOLONG  (Win32 206)
```

POSIX has a limit too — `E2BIG`, typically around 2MB on Linux — so the same code
survives an argument size that Windows refuses.

## Cause

`CreateProcess` caps its `lpCommandLine` parameter at 32,767 characters, and the
cap applies to the WHOLE assembled line: executable path, every argument, every
quote and separator the runtime inserted.

Windows reports that overflow as `ERROR_FILENAME_EXCED_RANGE` (206) — the same
code it uses for a path exceeding MAX_PATH. Node maps 206 to `ENAMETOOLONG`, so
two unrelated limits arrive under one name, and the name describes the one you are
not hitting.

That collision is the entire difficulty. Every search result for 206 and
`ENAMETOOLONG` is about MAX_PATH and long-path opt-in, none of which touches the
command-line cap. There is no registry switch and no manifest for this one; 32,767
is the ceiling.

The practical trigger is passing data as an argument: a JSON payload, a file list,
a serialized config. Those grow with the user's environment rather than with your
input, so they cross the line on someone else's machine.

## Workaround

Get the payload out of argv:

```js
// stdin — no size limit worth worrying about
const child = spawn(helper, ["--stdin"], { stdio: ["pipe", "inherit", "inherit"] });
child.stdin.end(JSON.stringify(payload));

// or a temp file, passing only the path
writeFileSync(tmp, JSON.stringify(payload));
spawnSync(helper, ["--payload-file", tmp]);
```

Both are better than argv even below the limit, because argv is visible in process
listings to every user on the machine — a payload with a token in it should never
have been an argument.

If you must keep it in argv, measure before spawning and fail with a message that
names the real limit. `payload_len=35044` in your own log is worth more than
os error 206 in the runtime's.

---

`max-path-260` owns the other meaning of error 206. The two cases exist
separately precisely because Windows reuses the code: one is a 260-character path
ceiling with a documented opt-in, the other is a 32,767-character command-line cap
with none.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/44>
- <https://github.com/openai/codex/issues/38985>
- <https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw>
