---
id: process-exit-fastfail-0xc0000409
title: "your CLI prints the right answer and then crashes with 0xC0000409, because process.exit ran while a socket was still closing"
category: exit-codes
versions: "both"
failure: misleading-error
context: [script, ci, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/ima2-gen/commit/fdc875930
  - https://github.com/lidge-jun/ima2-gen/commit/35a703b0d
  - https://github.com/lidge-jun/ima2-gen/commit/d066ab30d
ontology:
  affects: [runtime-node, env-windows]
  invokes: [command-node]
  manifests_as: [error-fastfail]
  caused_by: [mechanism-handle-close-race]
  mitigated_by: [workaround-exitcode-not-exit]
---

# your CLI prints the right answer and then crashes with 0xC0000409, because process.exit ran while a socket was still closing

## Symptom

The command works. The output is correct and complete. Then the process dies with
an exit code that means "the runtime detected corruption":

```
PS> mytool status
server: healthy
PS> $LASTEXITCODE
-1073740791          # 0xC0000409, STATUS_STACK_BUFFER_OVERRUN
```

Which sends you looking for memory corruption in your own code, where there is
none. CI turns red on a command whose output the same job just asserted was right.

On macOS and Linux the identical code exits 0.

## Repro

Any short-lived Node program that makes an HTTP request and then exits promptly:

```js
const r = await fetch("http://127.0.0.1:8080/api/health");
console.log((await r.json()).status);
process.exit(0);        // <- the crash
```

It is intermittent by nature — it needs the exit to land inside the window while
a handle is closing — so it shows up as a flaky Windows CI job long before anyone
reproduces it on purpose.

## Cause

`process.exit()` tears the runtime down immediately, without waiting for libuv to
finish closing handles. If a handle is in `UV_HANDLE_CLOSING` at that moment,
libuv trips an internal assertion, and Windows reports an aborted runtime as
`0xC0000409` — the fastfail code, whose documented meaning is stack buffer
overrun. The exit code describes the abort mechanism, not your bug.

`fetch` makes this easy to hit because undici keeps connections alive by default:
the socket is still open when your program is logically done, so an immediate exit
lands squarely in the closing window. `AbortSignal.timeout()` adds a second
handle with the same property — the timer outlives the request it was guarding
unless you clear it.

POSIX platforms tear down without the assertion, so the same race produces a clean
exit and nobody notices the code was wrong.

## Workaround

Set the code and let the loop drain:

```js
process.exitCode = 1;   // not process.exit(1)
return;                 // unwind normally; Node exits when handles are done
```

Then remove the handles that keep the loop alive rather than killing the loop:

```js
// close keep-alive sockets on a short-lived client
await fetch(url, { headers: { connection: "close" } });

// clear a timeout guard once the await resolves
const t = setTimeout(() => ctrl.abort(), 600);
try { await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
```

If you have a deep call stack and need to bail out, throw a sentinel and catch it
at the top level rather than calling `exit` from the middle.

The one case that still needs `process.exit()` is a deliberately stuck process,
and there the right shape is a bounded `unref`'d timer that fires only after the
graceful path has had its chance.

---

The corpus's other exit-code cases are about a status being lost, faked, or
misread. This one is about the exit itself being unsafe: the call you use to
report success is what makes the process report corruption.
