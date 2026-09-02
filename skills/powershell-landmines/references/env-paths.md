
# rmSync hits EPERM right after a clean server.stop() because a fire-and-forget icacls.exe still holds the directory

## Symptom

A test suite that starts a server, stops it with `await server.stop(true)`, and then removes its
scratch home fails in the teardown, not in the test:

```
error: EPERM: operation not permitted, rm 'D:\a\opencodex\opencodex\tests\.tmp-codex-accounts-test'
error: EBUSY: resource busy or locked, rm 'C:\Users\RUNNER~1\AppData\Local\Temp\ocx-api-usage-esM6Go'
```

Four Windows CI shards went red on every branch, including the released `main`, for three days.
Linux and macOS stayed green on the same commits. Individual test bodies passed; the
`afterEach` hook failed, and when the hook shared one fixed directory across cases, the first
failure poisoned every later case in the file (49 of 49 errors in one file, 377 in another were
hooks, not assertions).

## Repro

```js
// child.mjs — any child that touches the directory and outlives its parent's "done"
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

mkdirSync("scratch", { recursive: true });
// icacls holds the directory handle for the duration of the ACL rewrite
spawn("icacls.exe", ["scratch", "/inheritance:r", "/grant:r", "*S-1-5-32-544:(OI)(CI)F"], { stdio: "ignore" });
// "shutdown" that forgot about the child
rmSync("scratch", { recursive: true, force: true });
// → EPERM on Windows; silently fine on Linux/macOS
```

```powershell
PS> node child.mjs
node:fs:...  Error: EPERM: operation not permitted, rm 'scratch'
```

## Cause

Two Windows facts combine:

1. File locking is mandatory. A handle opened without `FILE_SHARE_DELETE` — which is what every
   ordinary process, including `icacls.exe`, holds while it works on a directory — makes the
   kernel refuse `unlink` (`EPERM`) and `rename` (`EBUSY`) until the handle closes. POSIX only
   removes the name; the data lives until the last descriptor goes away, so the same code never
   notices there.
2. Nothing ties a child's lifetime to its parent's notion of "finished". A `spawn` whose promise
   is dropped keeps running. `server.stop()` awaited listeners, background jobs and lifecycle
   hooks — everything the server started on purpose — but not the ACL flight a config read
   kicked off as an optimisation (`hardenConfigDir()` → `hardenSecretDirAsync()`, unawaited,
   introduced to stop the event loop from blocking on a slow `icacls`).

The regression was invisible on the machines developers use, and the CI signal was gated behind
`workflow_dispatch`, so it was attributed to "the hosted runner" for three days. It was the
product: the same suites had passed on the same `windows-latest` image before the async change.

## Workaround

The shutdown contract has to own every child the process started. Scope the flight to the
directory it works on and await it where you await everything else:

```ts
// paths.ts
const flights = new Map<string, Promise<void>>();
export async function flushConfigDirHardening(dir: string): Promise<void> {
  const flight = flights.get(dir);
  if (flight) await flight;
}

// server.ts
const configDir = getConfigDir();            // capture BEFORE the flight starts
server.stop = async () => {
  await closeListeners();
  await backgroundLifecycle.release();
  await flushConfigDirHardening(configDir);  // now rm after stop() is safe
};
```

Prove it with a test that holds the child on a promise and asserts `stop()` stays pending until
the promise resolves; drive it red once by commenting the await out.

Retrying `rmSync` on `EPERM`/`EBUSY` (50 × 50 ms) is a legitimate belt-and-braces for antivirus
and search-indexer handles, and this repo keeps one for fixtures. It is an unsafe *primary* fix
here: it hides the unowned child, the retry budget is a guess, and in production the same
child would still be holding a directory the uninstaller or a home move is about to touch.

---

This is the "who owns the child" half of the file-lifetime story. `unlink-while-open-ebusy`
is the "who owns the file" half; `kill-hits-one-pid-or-the-whole-tree` is what happens when the
parent leaves without either.



---


# your atomic write fails intermittently on Windows because antivirus opened the file you are replacing, milliseconds ago

## Symptom

The write-temp-then-rename pattern — the standard way to publish a file without
a torn read — throws on Windows for no reason you can reproduce:

```
Error: EPERM: operation not permitted, rename 'config.toml.tmp' -> 'config.toml'
```

Once a week. On one machine. Never on yours. Retrying by hand always works, which
is the tell.

The cost is not the failed write; it is that the file was not published while
your program believes the operation completed or failed cleanly. A journal entry
goes missing, a manifest keeps a stale value, a restore has nothing to restore.

## Repro

Deterministically, by holding the destination the way a scanner does:

```powershell
PS> "old" | Set-Content dest.txt
PS> "new" | Set-Content dest.txt.tmp
PS> $h = [IO.File]::Open("$PWD\dest.txt", 'Open', 'Read', 'None')   # no share mode
PS> node -e "require('fs').renameSync('dest.txt.tmp','dest.txt')"
Error: EPERM: operation not permitted, rename ...
PS> $h.Close()      # now it succeeds
```

In production nobody opens it explicitly. Defender, a backup agent, the search
indexer, or a cloud-sync client takes that handle for a few milliseconds after
you write the temp file, which is exactly when you rename.

## Cause

POSIX `rename(2)` is atomic and unconditional: it does not care who has the
destination open, because unlink semantics let the old inode live on for existing
holders.

Windows has no such escape. A handle on the destination opened without
`FILE_SHARE_DELETE` blocks the replace, and the failure surfaces as `EPERM`,
`EBUSY`, or `EACCES` depending on which layer refused. All three mean the same
thing here: someone else has it, briefly.

"Briefly" is the important word. These holds are transient by nature — a scanner
reads and closes — so the operation that failed will succeed a moment later. That
is what separates this from a genuine permission problem, and it is why a single
attempt is the wrong shape for a durable publish on Windows.

## Workaround

Retry the rename a bounded number of times, only on the transient codes, only on
Windows:

```js
const TRANSIENT = new Set(["EPERM", "EBUSY", "EACCES"]);

function renameAtomic(from, to) {
  const attempts = process.platform === "win32" ? 3 : 1;
  for (let i = 0; i < attempts; i++) {
    try { return renameSync(from, to); }
    catch (err) {
      const last = i === attempts - 1;
      if (last || !TRANSIENT.has(err.code)) throw err;
      sleepSync(25 * (i + 1));    // 25ms, then 50ms
    }
  }
}
```

Keep the bound small and honest. Two retries covers a scanner; a longer loop
turns a real permission error into a hang, and it stops being a fix and starts
being a guess.

Apply it at EVERY durable publish, not just the one that failed first. The
failure is a property of the platform, not of that call site, so a codebase with
one hardened writer and eight bare `renameSync` calls has one hardened writer and
eight latent bugs.

And do not use this for directory moves. Those fail on Windows for different
reasons and retrying will not help.

---

`unlink-while-open-ebusy` is the same mandatory-locking mechanism from the delete
side, where the holder is usually your own orphaned child. Here the holder is
someone else's process, it lets go on its own, and the fix is patience rather
than cleanup.


---


# cmd.exe refuses a UNC working directory, so every .cmd shim breaks when your terminal is opened inside a WSL or network path

## Symptom

An install or a build fails before it does anything, with a warning about the
current directory rather than about your command:

```
'\\wsl.localhost\Ubuntu\home\me\project'
CMD.EXE was started with the above path as the current directory.
UNC paths are not supported.  Defaulting to Windows directory.
```

Then whatever followed runs in `C:\Windows` and cannot find your project. The
realistic trigger is not a network share — it is opening a terminal inside a WSL
directory, or launching a task from an editor whose workspace lives there.

What makes it confusing is that the command itself is fine. `npm`, `yarn`, and
`corepack` are all `.cmd` shims, so any of them hops through cmd.exe and inherits
the refusal, while the same command run from `C:\` works perfectly.

## Repro

```
C:\> pushd \\wsl.localhost\Ubuntu\home\me
C:\> cmd /c npm --version
'\\wsl.localhost\Ubuntu\home\me'
CMD.EXE was started with the above path as the current directory.
UNC paths are not supported.  Defaulting to Windows directory.
```

PowerShell has no such limitation and will happily sit in that directory, which is
why the failure appears only for the subset of tools that shell out through
cmd.exe.

## Cause

cmd.exe cannot hold a UNC path as its current directory. The limitation is
historical — the current directory is a drive-relative concept in its model, and a
UNC path has no drive — and it has never been lifted. When cmd.exe starts in one,
it prints the warning and silently relocates to the Windows directory rather than
failing outright.

That silent relocation is the whole problem. The process keeps going with a
working directory nobody chose, so downstream failures are about missing files
rather than about the directory, and the warning that explains it scrolls past
above the real error.

POSIX has no equivalent: a network mount is an ordinary path, and a shell can
chdir into it like anywhere else. So code that shells out through a `.cmd` shim
picks this up on Windows only, and only for users whose project lives on a UNC
path — which increasingly means anyone working in WSL from a Windows terminal.

## Workaround

Run the shim from a local directory and pass absolute paths:

```powershell
Push-Location -LiteralPath $env:TEMP     # any drive-backed directory
try   { & $CommandPath @Arguments }      # shim now starts on a real drive
finally { Pop-Location }
```

The arguments still name the UNC location, which is fine — cmd.exe objects to
being IN one, not to being handed one.

The other durable answer is to map the UNC path to a drive letter with
`net use` or `pushd` (which does it automatically and cleans up on `popd`), so
the working directory is drive-backed for everything downstream.

Do not silence the warning without fixing the directory. The relocation happens
either way, and the message is the only clue about why your build cannot see its
own files.

---

`wsl-unc-rejects-nt-acl` is the other half of the WSL UNC story: there a security
operation has nothing to act on. Here the path is refused as a working directory
by one specific shell, and everything that hops through that shell inherits it.


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


---


# $env:USERDOMAIN is not your identity

## Symptom

An ACL/permissions script builds a principal as `"$env:USERDOMAIN\$env:USERNAME"`
and passes it to `icacls`. It works on the dev machine, then fails on a renamed
computer, a Microsoft-account login, or an AzureAD-joined machine: icacls cannot
resolve the principal, the grant fails, and if the code fails closed, the whole
feature dies.

## Repro

```powershell
# On a workgroup (non-domain) machine:
$env:USERDOMAIN          # -> COMPUTERNAME, not a domain
# Microsoft-account login: local profile name != account name
icacls secret.txt /grant "$env:USERDOMAIN\$env:USERNAME:(R)"
# -> "No mapping between account names and security IDs was done."
```

## Cause

`USERDOMAIN` is always set — on a workgroup machine it silently holds the computer
name, so `domain ? "domain\user" : user` fallbacks never fire. Both variables are
also plain environment values, writable by whatever launched the process, which
makes them attacker-influenceable in a permissions path.

## Workaround

Use the SID, which is what the token actually carries and which icacls accepts
directly:

```powershell
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls secret.txt /grant "*${sid}:(R)"
```

The referenced production fix replaced the env-derived principal with the current
token's SID for exactly the failure modes above.


---


# Spreading {...env, PATH} leaves the old Path sitting next to it

## Symptom

JS code overrides PATH for a child process: `{...process.env, PATH: shimDir}`.
On Windows the child sometimes resolves tools from the ORIGINAL path anyway —
the shim directory is ignored, intermittently, depending on which library reads
the env.

## Repro

```js
// Windows: process.env has key "Path" (registry casing)
const env = { ...process.env, PATH: "C:\\shims" };
// env now has BOTH "Path" (inherited) and "PATH" (yours).
// Consumers reading env.Path, or iterating keys first-match, use the old list.
```

## Cause

Windows environment variable NAMES are case-insensitive, but JS objects are
case-sensitive. The inherited key is usually `Path`; adding `PATH` creates a
duplicate rather than replacing it. Which one wins depends on the consumer —
CreateProcess dedupes one way, Node libraries another.

## Workaround

- Find the existing key case-insensitively and overwrite THAT key:
  `const k = Object.keys(env).find(x => x.toUpperCase()==="PATH") ?? "PATH"`.
- Never introduce a second casing into a copied env (the referenced fix's
  lookup() does exactly this).


---


# Appending to $env:Path and saving to User PATH copies Machine PATH in

## Symptom

After an installer "adds one directory to PATH", the user's User PATH suddenly
contains the entire system PATH — duplicated. Future Machine PATH changes get
shadowed by the stale copy, and the PATH grows every time the pattern runs.

## Repro

```powershell
# The innocent-looking pattern:
[Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\tools', 'User')
# $env:Path is the MERGED Machine+User view — you just wrote all of it into User.
```

## Cause

`$env:Path` is the process-level merge of Machine and User PATH. Using it as
the base for a User-scope write permanently copies every Machine entry into the
User value. The corruption is silent and compounds across installers.

## Workaround

```powershell
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*C:\tools*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;C:\tools", 'User')
}
```

Read the specific scope, append only the missing entry. The referenced fix
replaced the merged-view guidance with exactly this scope-read pattern.


---


# the is-main guard built by concatenating file:// with argv[1] can never be true on Windows, so your CLI exits 0 doing nothing

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


---


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


---


# icacls /inheritance:r before the grant leaves a file with no ACEs at all, so an interrupted hardening script locks every consumer out of a file that still says you own it

## Symptom

A hardening routine that locks down a secrets file half-runs — a timeout, a
transient failure, a killed CI job — and afterwards nothing can read it:

```
Access is denied.
```

You own it. `dir` shows it. You cannot read it and cannot delete it, and neither
can the service that needs it. Re-running the hardening script does not help,
because it starts by stripping inheritance again on a file that already has no
ACEs. Recovery exists, but it is a DIFFERENT command than the one that broke it,
and nothing in the failure tells you that.

## Repro

The dangerous order, interrupted after the first step:

```
C:\> echo secret > secret.txt
C:\> icacls secret.txt /inheritance:r
processed file: secret.txt

C:\> type secret.txt
Access is denied.

C:\> del secret.txt
Access is denied.
```

The file now has an owner and an EMPTY DACL, which is not the same as no DACL: an
empty DACL grants nothing to anyone, while a null DACL grants everything to
everyone. Every consumer is locked out, including the service the hardening was
for.

Recovery is possible because ownership carries `WRITE_DAC` — but only through a
different invocation:

```
C:\> icacls secret.txt /grant *S-1-5-32-544:(F)
C:\> icacls secret.txt /reset
```

That is the part that makes this expensive in practice: the automation cannot
self-heal by retrying, and a human has to know that `/grant` or `/reset` is the
way back in.

POSIX `chmod 000` is a fair comparison for the data access and not for the
recovery — there the owner restores the mode with the same tool they broke it
with.

## Cause

`/inheritance:r` removes inherited ACEs IMMEDIATELY, and it does not care that
the explicit ACEs meant to replace them do not exist yet. Between that call and
the grant that follows, the file's DACL is empty — and an empty DACL is not
"default permissions", it is "deny everyone".

POSIX intuition breaks in two places here. First, ownership does not imply read
access on Windows the way it effectively does under a POSIX mode. Second, there is
no single atomic operation that says "these are the permissions now"; `icacls` is
a sequence of mutations, and every gap between them is a state a crash can leave
you in.

So the ordering is not a style preference. Restrict-then-grant has a window where
failure is unrecoverable by the same tool; grant-then-restrict does not.

## Workaround

Grant first, restrict second, and treat the sequence as one that can be
interrupted at any point:

```
icacls "%TARGET%" /grant *%SID%:(F)          rem 1. keep a way back in
icacls "%TARGET%" /inheritance:r             rem 2. now safe to strip
icacls "%TARGET%" /remove:g *S-1-5-32-545    rem 3. drop the rest
```

Name principals by SID rather than by `USERDOMAIN\USERNAME` — that is
`env-domain-principal`, and it matters here because a grant against the wrong
name is a grant that did not happen.

For a directory, the grant needs the inheritance flags — `(OI)(CI)(F)` — or
children created later inherit nothing.

Design the routine so that failure at any step leaves the target USABLE rather
than merely leaving it unhardened. Unhardened is a security finding you can fix on
the next run; locked-out is a support ticket.

Verify at the end rather than trusting exit codes: `icacls` reports per-file
success lines, and a partially applied ACL can still exit zero on the step that
did run.

---

`env-domain-principal` covers WHO to name in the grant — the token SID rather
than `USERDOMAIN\USERNAME`. This case is about WHEN: the identity can be perfectly
correct and the order still locks every consumer out.


---


# the folder API you use to find AppData returns an empty string instead of failing, so a redirected profile silently gives you the filesystem root

## Symptom

Code that asks Windows where the user's data directory is gets `""` back. Not an
exception, not a null — an empty string that flows straight into the next
`path.join`, so the path you build points at the drive root or at your process's
working directory.

Downstream, everything reports the wrong thing at once: a lock file in the wrong
namespace, a cache that never hits, a coordinator that refuses every lookup. The
symptoms are so scattered that they read as unrelated failures across several
modules, and none of them mentions AppData.

It only happens to some users, which is what makes it expensive: anyone whose
profile is redirected, and any service account whose profile has never been
materialized on that machine.

## Repro

The documented behavior is that the call returns an empty string, rather than
throwing, when the folder it would name does not physically exist:

```powershell
PS> [Environment]::GetFolderPath('LocalApplicationData')
C:\Users\me\AppData\Local

PS> # on an account whose profile has never been materialized on this machine
PS> ([Environment]::GetFolderPath('LocalApplicationData')).Length
0
```

The realistic triggers are a service account running before first interactive
logon, a redirected or roaming profile that has not been created on this host,
and a sandboxed CI user. What they share is that the folder is legitimately
absent, which the API answers by declining to name it.

And the shape that reaches production:

```js
const base = getLocalAppData();          // "" for a redirected profile
const dir = path.join(base, "myapp");    // "myapp" — relative to cwd, not AppData
```

The POSIX habit that fails here is assuming a lookup either succeeds or throws.
This one has a third outcome.

## Cause

`GetFolderPath(SpecialFolder.LocalApplicationData)` verifies the folder before
answering, and when verification fails it returns an EMPTY STRING rather than
throwing. Microsoft documents that behavior plainly, and it is defensible: "the
folder does not exist" is a different question from "where would it be".

That is a defensible API contract and a terrible default for callers, since the
empty string is a perfectly valid argument to every path function you will hand
it to. Nothing downstream can tell the difference between "AppData is here" and
"nobody knows".

There is a second hazard stacked on top for anyone who reaches for the
environment instead: `USERPROFILE`, `LOCALAPPDATA`, `HOMEDRIVE`, and `HOMEPATH`
are all writable by anything in the process tree, so a value your code treats as
identity is inherited state that a parent process can set.

## Workaround

Ask the known-folder registration for the effective token instead of asking the
environment:

```powershell
# SHGetKnownFolderPath, FOLDERID_LocalAppData, KF_FLAG_DONT_VERIFY (0x4000)
$sig = '[DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern int ' +
       'SHGetKnownFolderPath(ref System.Guid id, uint flags, System.IntPtr token, out System.IntPtr path);'
Add-Type -MemberDefinition $sig -Name Shell32 -Namespace Win32 | Out-Null
$id  = [Guid]'F1B32785-6FBA-4FCF-9D55-7B8E7F157091'
$out = [IntPtr]::Zero
$hr  = [Win32.Shell32]::SHGetKnownFolderPath([ref]$id, 0x4000, [IntPtr]::Zero, [ref]$out)
if ($hr -ne 0) { throw "SHGetKnownFolderPath failed: 0x{0:X8}" -f $hr }
try   { [Runtime.InteropServices.Marshal]::PtrToStringUni($out) }
finally { [Runtime.InteropServices.Marshal]::FreeCoTaskMem($out) }
```

Three details decide whether this actually helps:

- `KF_FLAG_DONT_VERIFY` (0x4000) is the flag that returns the path whether or not
  the directory exists. `KF_FLAG_DEFAULT_PATH` (0x400) is a different thing — it
  asks for the DEFAULT rather than the current, possibly redirected, path, and it
  still verifies existence unless you also pass DONT_VERIFY. Reaching for 0x400
  because it sounds like "just give me the default answer" gets you neither.
- A NULL token means the current user. Passing `(HANDLE)-1` is not equivalent: it
  resolves the built-in Default profile, a namespace no real account writes to,
  which turns a wrong answer into a plausible-looking one.
- Check the HRESULT and free the buffer with `CoTaskMemFree`. The API allocates,
  and a nonzero HRESULT leaves the pointer undefined.

Whatever API you settle on, treat an empty result as a hard failure at the
boundary. A path helper that can return `""` should refuse instead, because every
consumer downstream will silently accept it.

---

`env-domain-principal` is the identity version of the same family: trusting
`USERDOMAIN` and `USERNAME` instead of resolving the token SID. This is the
location version, and it carries an extra hazard — the wrong answer is EMPTY
rather than wrong, so it slips past a null check you did not think to write and
becomes a relative path.

## Verification note

The empty-string return and the flag semantics are quoted from Microsoft's
`Environment.GetFolderPath` and `KNOWN_FOLDER_FLAG` documentation. Which
environment variables the default lookup consults internally is NOT documented,
so this case does not claim a specific variable causes the empty result — only
that the folder being absent does. `repro: historical`; no Windows host was used.


---


# the 260-character path limit is still there, the registry switch alone does not lift it, and the tree you created may be one nothing can delete

## Symptom

An install or a checkout dies partway down a nested directory:

```
ENAMETOOLONG: name too long, mkdir 'C:\Users\...\node_modules\...'
```

Or, worse, the create SUCCEEDS and the cleanup does not. You are left with a
directory Explorer cannot open and `rm -rf` equivalents cannot remove, on a
machine where the same repository clones fine two folders higher.

Python users see a third face of it: `FileNotFoundError`. The path is not
missing; it is too long.

## Repro

Start from a SHORT root, or the first create already exceeds the limit and the
demonstration never runs — a normal `%TEMP%` is already 30 to 50 characters:

```powershell
PS> New-Item -ItemType Directory -Force C:\t | Out-Null
PS> Set-Location C:\t
PS> $a = 'a' * 200          # C:\t\<200> is ~205, under the 248 directory ceiling
PS> New-Item -ItemType Directory -Force $a | Out-Null
PS> New-Item -ItemType Directory -Path (Join-Path $a ('b' * 100))   # crosses 260
```

What that second create throws depends on the host, which is its own trap:
.NET Framework raises `PathTooLongException` (HRESULT 0x800700CE), while
PowerShell 7 surfaces an `IOException` wrapping `ERROR_FILENAME_EXCED_RANGE`
(206).

The prefixed form works where the plain one does not:

```powershell
PS> $long = "\\?\$PWD\" + (('d'*200 + '\') * 3)
PS> [IO.Directory]::CreateDirectory($long)      # succeeds
PS> Remove-Item -LiteralPath $long.Substring(4) -Recurse   # may fail
PS> [IO.Directory]::Delete($long)               # prefixed delete works
```

That asymmetry is the trap: the thing that created the tree and the thing asked
to delete it are rarely the same program.

## Cause

`MAX_PATH` is 260 characters, and the count includes the drive letter, the colon,
the backslash, every component, and the terminating NUL. On `D:` that leaves 256
usable characters. Directory creation is tighter still — the path must leave room
for an 8.3 name, so the effective ceiling is 248 — which is why you can have a
directory that exists and refuses to hold a file.

The `\\?\` prefix tells Win32 to skip path parsing and hand the rest to the
filesystem, lifting the limit to roughly 32,767 characters with each component
capped by the volume (usually 255). It comes with conditions people miss: it
requires a fully-qualified path, it does not work on relative paths, it does not
expand `.` or `..`, it does not convert forward slashes, and it does nothing for
the ANSI `*A` APIs.

Windows 10 1607 added a second door, and BOTH halves are required:

1. `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` set to 1
   (or the equivalent Group Policy), and
2. the process manifest declaring `<longPathAware>true</longPathAware>`.

Microsoft states the consequence plainly: enabling the registry value "will only
affect applications that have been modified to take advantage of the new
feature". The registry alone is a no-op for an unaware binary — which is exactly
why the switch has a reputation for not working.

Runtimes differ, and the difference is not obvious from the outside. CPython
ships the manifest, so its documentation can honestly say the registry setting
plus a reboot is enough. Go does not wait for the opt-in: `os.fixLongPath`
prepends `\\?\` itself when the OS setting is off. Node's source manifest does
not declare long-path awareness, and libuv passes the caller's path to
`CreateFileW` as-is.

The error codes are `ERROR_FILENAME_EXCED_RANGE` (206) and
`ERROR_BUFFER_OVERFLOW` (111), sometimes `ERROR_PATH_NOT_FOUND` (3) when an
intermediate component cannot be opened. Node maps 206 and 111 to
`ENAMETOOLONG`; Python maps 206 to `ENOENT`, which is how the same wall becomes
"file not found" in one language and "name too long" in another.

The POSIX contrast is not "Linux has a bigger number". `PATH_MAX` is 4096 and is a
per-call limit on the pathname argument, not a property of the filesystem — you
can build a deeper tree with successive relative operations. `MAX_PATH` is an API
ceiling that applies even when NTFS would happily store the file.

## Workaround

Pick one and be explicit about it:

- **Opt in properly**: set `LongPathsEnabled` AND ship a `longPathAware`
  manifest. Half of that is not a fix.
- **Prefix at the call site**: pass fully-qualified `\\?\C:\...` (or
  `\\?\UNC\server\share\...`) to Unicode APIs that document support for it.
- **Keep roots short** when you do not control every consumer. Explorer, cmd.exe,
  CI helpers, and package managers are all consumers you probably do not control.

What does not work: the registry without the manifest, the manifest without the
registry, the prefix on a relative path or with forward slashes, the prefix on
ANSI APIs, and assuming a tree created through a prefixed API can be removed by
one that is not. Do not assume 1607 ended this — unaware applications, relative
paths, and the shell all still meet 260.

## Verification note

Every load-bearing claim is from Microsoft's documentation: the 260 layout
including the terminating NUL, the 248 directory ceiling, the extended-length
prefix and its restrictions, and the two-part 1607 opt-in with the "will only
affect applications that have been modified" wording.

The runtime opt-in table is read from each project's SOURCE — CPython's
`PC/python.manifest`, Go's `os.fixLongPath`, Node's `node.exe.extra.manifest` —
not from a shipped binary, so a distributed build could in principle merge a
manifest fragment its source tree does not declare.

The exception types named in the repro are what the documented error codes map to
per runtime, not observed throws; this corpus has no Windows host, hence
`repro: historical`.

---

`reserved-dos-device-names` is the other Win32 path-parsing rule that a POSIX
filename can violate without anyone noticing until Windows. That one fails
silently; this one usually fails loudly, and its cruelty is in the cleanup rather
than the create.


---


# node:path delimiter follows the HOST, so win32 PATH logic resolves nothing when tested from Linux

## Symptom

Windows PATH-resolution code is correct on Windows and silently resolves
**nothing** when the same function is exercised from Linux — a unit test, a CI
matrix, a cross-platform test that passes `platform: "win32"` as a parameter.

Nothing throws. The walk just finds no candidates, and the caller falls through
to whatever its "not found" branch does. On Windows the test passes, so the bug
ships in the direction nobody looks.

## Repro

```js
import { delimiter } from "node:path";

// A Windows PATH, being parsed by win32-only resolution logic
const winPath = "C:\\a;C:\\b;C:\\c";
winPath.split(delimiter);
// on Windows: ["C:\\a", "C:\\b", "C:\\c"]
// on Linux:   ["C:\\a;C:\\b;C:\\c"]   <- one bogus entry, no error
```

## Cause

`node:path`'s `delimiter` (and `sep`) follow the **host**, not the data. A
Windows PATH is always `;`-separated regardless of where the string is being
parsed. The moment you make platform a *parameter* — which is exactly what you do
to make win32 logic testable from CI — the host-derived constant stops matching
the input.

`path.win32.delimiter` exists and is the honest fix, but the bare import is what
editors autocomplete and what reads as "correct, cross-platform" in review.

## Workaround

- Split a Windows PATH on a literal `";"`, or use `path.win32.delimiter`
  explicitly. Same for `path.win32.sep` / `path.posix.sep`.
- Treat any host-derived constant inside platform-parameterized code as a bug:
  if `platform` is an argument, `delimiter`, `sep`, `homedir()` and
  `process.platform` must not appear in the same function.
- Assert the split in a test that runs on Linux, not just on Windows.

## Why it belongs here

This is the mirror image of most cases in this archive: not a POSIX assumption
exploding on Windows, but **Windows-handling code quietly failing everywhere
else**. It is the failure mode you get *after* you do the right thing and make
your win32 path logic testable off-Windows.

## Real-world hit

Shipped in three byte-identical copies of a shared helper in
lidge-jun/codexclaw and only surfaced when a win32-only resolver was exercised
from a WSL/Linux test lane.
Fix: https://github.com/lidge-jun/codexclaw/commit/5c03acb


---


# the filesystem says two paths are the same file and your config map says they are two keys, so a trusted project reads as untrusted

## Symptom

A lookup keyed by a path misses, for a path that unambiguously exists and that
every other part of the system resolves fine:

```
Can't verify project trust for C:\Users\me\Codex-Orchestrator
```

The entry is right there in the config:

```toml
[projects.'c:\users\me\codex-orchestrator']
trust_level = "trusted"
```

Adding a SECOND entry with the exact casing the caller used fixes it immediately,
and both entries coexist happily — which is the tell that this is a key
comparison rather than a filesystem problem.

Caches miss, allowlists do not match, dedupe stores the same path twice, and a
"have I seen this before" check answers no forever.

## Repro

```js
const seen = new Map();
seen.set("c:\\users\\me\\project", true);
seen.has("C:\\Users\\me\\Project");   // false

const { realpathSync } = require("node:fs");
realpathSync("c:\\users\\me\\project") ===
realpathSync("C:\\Users\\me\\Project");   // true — one directory
```

The two spellings name one directory and are two distinct strings. On Linux they
would name two different directories, so the string comparison would be right.

Do not reach for `stat().ino` to prove identity here: on Windows the inode is
frequently reported as 0, so comparing it proves nothing at all.

## Cause

NTFS is case-INSENSITIVE and case-PRESERVING: it stores the casing you used and
ignores casing when matching. So the filesystem happily treats `c:\users\...` and
`C:\Users\...` as one object, while every ordinary string container — a `Map`, a
JSON object, a TOML table, a `Set`, a SQL unique index — treats them as two.

Where the differing casing comes from is the part you cannot control:

- a user hand-editing a config in lowercase
- `%USERPROFILE%` versus a literal `C:\Users\...` from a different component
- a short 8.3 name in `%TEMP%` for some accounts
- a drive letter that arrives lowercase from one API and uppercase from another
- a remote or mobile client sending the path it was shown

So the collision appears when TWO components meet, which is why it survives every
single-component test.

Lowercasing everything is the obvious fix and is wrong on its own: the same code
usually runs on Linux, where lowercasing makes two genuinely different files
collide. The correct key depends on the platform, which means it has to be
computed rather than assumed.

## Workaround

Canonicalize before using a path as a key, and make the canonicalization
platform-aware:

```js
const { resolve, sep, posix } = require("node:path");

function pathKey(p) {
  const abs = resolve(p).split(sep).join(posix.sep);
  return process.platform === "win32" ? abs.toLowerCase() : abs;
}
```

Normalize the separators too, or `C:/x` and `C:\x` become the next pair of keys
that should have matched.

When the key is persisted — a config file, a database, a lock file — canonicalize
on WRITE as well as on read, and migrate existing entries. A store that already
holds both spellings will keep answering inconsistently no matter how correct the
read path becomes.

For a real identity check rather than a key, compare resolved paths through the
filesystem: `realpathSync` on both sides handles casing, junctions, and symlinks
together.

---

`env-path-vs-PATH-casing` is the environment-variable version — `Path` versus
`PATH` as a variable NAME. This is the filesystem version, and the trap is
sharper: there the two names refer to one variable by design, here two strings
refer to one file while your data structure insists they are two.


---


# Joining PATH with ':' silently no-ops on Windows

## Symptom

A test or script prepends a directory to PATH with a colon:
PATH = binDir + ":" + oldPath. On Windows the tool in binDir is never found —
no error, the entry just does not participate in resolution.

## Repro

```js
process.env.PATH = binDir + ":" + process.env.PATH;   // POSIX habit
// Windows PATH is ;-separated: the whole thing becomes ONE bogus entry
// "C:\\bin:C:\\Windows\\system32;..." — binDir is unfindable.
```

## Cause

Windows separates PATH entries with semicolons; colons appear INSIDE entries as
drive designators (C:). A colon-joined PATH fuses your new directory with the
first original entry into one nonexistent path. The same bug appears in
PowerShell as \$env:Path = "\$bin:\$env:Path".

## Workaround

- Use the platform delimiter: Node path.delimiter (the referenced fix), or
  [IO.Path]::PathSeparator in PowerShell.
- Sibling traps: splitting on ':' shreds C:\\ entries (node-path-host-
  delimiter) and duplicate Path/PATH casings fight each other
  (env-path-vs-PATH-casing).


---


# A '.' entry on PATH lets the repo you just opened execute its own npm

## Symptom

A tool spawns `npm` on Windows. In most directories it runs the real npm. In
one particular cloned repo, it runs... something else. Nothing errored; the
attacker-controlled `npm.cmd` in the repo root simply won.

## Repro

```
PATH=.;C:\Program Files\nodejs\
cd C:\cloned\evil-repo    # contains npm.cmd
npm --version              # executes .\npm.cmd — the repo's file
```

## Cause

cmd.exe (and resolution that mimics it) walks every PATH entry in order,
including relative entries like `.`. A leading dot entry makes the CURRENT
DIRECTORY the highest-priority tool source — so opening a repository is
equivalent to prepending that repository to PATH.

## Workaround

- When resolving commands for spawn, skip relative PATH entries and the exact
  cwd (but not legitimate home-subtree entries like %AppData%\npm — the
  referenced fix threads that needle).
- Defense in depth: resolve to absolute paths once, then spawn the absolute path.


---


# one stray quote in PATH makes every entry after it disappear, for your program only — the same shell still finds them

## Symptom

Your program cannot find a tool that is unambiguously installed and on PATH:

```
Error: failed to run git clone ...: program not found
```

From the same shell, in the same session:

```
PS> where.exe git
C:\Users\me\AppData\Local\hermes\git\cmd\git.exe
PS> git --version
git version 2.54.0.windows.1
```

So the tool is there, the shell finds it, and your process says it does not
exist. Every diagnostic you reach for agrees with the shell and against your
program, which is why this burns an afternoon.

## Repro

```rust
// PATH = C:\Program Files\PowerShell\7";C:\tools\git\cmd;C:\Windows\System32
std::env::split_paths(&std::env::var_os("PATH").unwrap()).count();
// the stray quote opens a span that never closes, so everything after it
// collapses into ONE entry naming a directory that does not exist
```

```powershell
PS> where.exe git
C:\tools\git\cmd\git.exe        # the shell has no trouble
```

The stray `"` after `7` is the whole bug. It is trivially easy to produce: a
quoted PATH entry with a typo, an installer that appends without checking, or a
hand-edited environment variable.

## Cause

Windows PATH entries may be QUOTED, because the separator is `;` and a directory
name may legally contain one. So a correct PATH parser has to be quote-aware:
inside quotes, a semicolon is data rather than a separator.

That is exactly what makes an unmatched quote catastrophic. The parser opens a
quoted span at the stray `"` and never finds its closer, so every remaining
semicolon is swallowed as part of one enormous, nonexistent directory name. Rust's
`std::env::split_paths` behaves this way, and it is behaving correctly.

Whether you are affected depends entirely on which splitter you use, and the
differences are larger than "quote-aware or not":

- `std::env::split_paths` honors a quote ANYWHERE in an entry, so a stray one
  mid-entry opens a span that swallows every later separator. This is the case
  that bites.
- libuv, which is what Node uses to resolve a command, treats an entry as quoted
  only when it STARTS with a quote. A mid-entry quote does not open a span there,
  so Node keeps finding the later entries.
- Naive `split(';')` never opens a span at all.
- `where.exe` and PowerShell's own resolution are unaffected.

Three parsers, three behaviors, one PATH. That is the part worth carrying away:
"is this PATH valid" has no single answer, so a diagnostic run through a
different runtime than the failing program can confirm the wrong thing.

So the failure is not "PATH is broken". It is "PATH is broken for the correct
parsers only", which inverts the usual debugging instinct: the tools you trust to
check are the ones that cannot see the problem.

## Workaround

Fix the PATH — but you usually cannot, because it is the user's machine. So make
the failure legible instead:

```rust
let raw = std::env::var_os("PATH").unwrap_or_default();
let quotes = raw.to_string_lossy().matches('"').count();
if quotes % 2 != 0 {
    eprintln!("PATH contains an unmatched quote; entries after it are unreadable");
}
```

An odd number of quote characters in PATH is always a bug in the PATH, and
checking for it costs one line. Reporting THAT instead of "program not found"
turns a multi-hour hunt into a one-line fix for the user.

If you must be tolerant, fall back to naive semicolon splitting when the
quote-aware parse yields an entry containing `;` — that entry is fictional by
construction.

## Verification note

The `std::env::split_paths` behavior is read from the Rust standard library
source, and the failure was reported against a Rust binary on Windows
(openai/codex#38421) with `where.exe` succeeding in the same shell. The
contrasting libuv behavior is read from its process source. Neither was executed
in this loop, hence `repro: historical`.

---

`node-path-host-delimiter` is about the SEPARATOR being wrong (`:` versus `;`).
This is one level deeper: the separator is right, the parse is right, and one
character of user data makes the stricter parser produce a fictional answer while
the looser ones carry on.


---


# An extensionless shim on PATH is invisible to Windows spawn — ENOENT with the file right there

## Symptom

A test fixture (or dotfiles setup) drops an extensionless shebang script named
`codex` into a PATH directory — the POSIX way. Windows spawn returns ENOENT.
The file exists, is on PATH, and chmod 755 "succeeded" (a no-op on NTFS).

## Repro

```js
// binDir/codex  (#!/bin/sh script, no extension), binDir on PATH:
spawnSync("codex");        // ENOENT — never a candidate
```

## Cause

CreateProcess/PATHEXT resolution only tries the extensions in PATHEXT
(.COM;.EXE;.BAT;.CMD;...). An extensionless file is not in the candidate set at
all — there is no execute bit to save it, because NTFS ignores POSIX modes.
Distinct from npm-ps1-not-comspec (a WRONG shim wins) and pathext-exe-beats-cmd
(rank order): here NOTHING PATHEXT-legal exists, so resolution finds nothing.

## Workaround

- Ship .cmd (or .exe) alongside any extensionless POSIX shim when Windows is a
  target; fixtures must create platform-appropriate shims.
- Diagnosis rule: "ENOENT but the file is right there on PATH" on Windows =
  check the extension against PATHEXT first.


---


# A sibling .exe silently beats your .cmd shim — PATHEXT rank order

## Symptom

A wrapper that rewrites `tool.cmd` works for months. Then an updater drops
`tool.exe` in the SAME directory and every invocation silently bypasses the
wrapper — no error, just the unwrapped binary running.

## Repro

```powershell
$env:PATHEXT   # .COM;.EXE;.BAT;.CMD;...  ← .EXE outranks .CMD
# dir with both tool.exe and tool.cmd → "tool" resolves to tool.exe, always.
```

## Cause

PATHEXT is an ordered list. Extensionless resolution tries `.COM`, then
`.EXE`, then `.BAT`/`.CMD` — within the same PATH entry. A shim strategy that
only owns the `.cmd` name is one updater run away from being invisible.

## Workaround

- Shim ALL launchable siblings (or rename/refresh the `.exe` too, as the
  referenced fix does).
- Detection: after installing a shim, resolve the bare name again and verify it
  lands on your shim.


---


# writing to nul.txt succeeds and creates nothing, because a handful of MS-DOS device names are still reserved in every directory

## Symptom

A file write reports success and the file is not there. No exception, no error
code, nothing in the directory listing:

```
C:\> echo hello > nul.txt
C:\> dir nul.txt
File Not Found
```

The realistic version is not someone typing `nul.txt`. It is an extractor
unpacking an archive that contains `aux`, a generator naming a file from a data
field that happens to be `con`, or a test fixture named after a case id. Those
work on Linux and macOS, so they reach Windows already committed.

## Repro

```
C:\> echo hello > NUL.txt
C:\> echo hello > NUL.tar.gz
C:\> mkdir sub && echo hello > sub\NUL.txt
C:\> dir /b
sub
```

Microsoft's own documented example, with the superscript form:

```
C:\> echo test > COM¹
```

That "fails to create a file" — the docs say so in those words, and the
superscript digits are the sentence that makes the reservation explicitly apply
in every directory rather than only at the root.

On Linux and macOS all of these are ordinary filenames.

## Cause

`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9` and the ISO-8859-1
superscript forms (`COM¹`, `COM²`, `COM³`, and the `LPT` equivalents) are MS-DOS
device aliases that Win32 still honors. Path parsing recognizes a legacy device
name as its own path type and rewrites it into the NT device namespace before any
directory is applied, so `C:\anywhere\NUL.txt` resolves to the Null device rather
than to a file in that folder.

Three details do most of the damage:

- **An extension does not help.** Microsoft documents `NUL.txt` and
  `NUL.tar.gz` as both equivalent to `NUL`.
- **`CreateFile` opens devices as well as files**, so the call SUCCEEDS. That is
  why there is no error to catch: your bytes went to the Null device, and a
  write to `CON` goes to the console instead.
- **The list is exact and short.** `COM10`, `COM0`, `CON1`, and `console.txt` are
  not reserved. `CON.txt` is. Serial ports past 9 need the `\\.\COM56` form
  precisely because they are not in the legacy set.

When a reserved-name call fails rather than succeeds, the runtime error adds a
second layer of confusion. Following the published mapping tables, Win32
`ERROR_INVALID_NAME` (123) reaches Node as `ENOENT` and Python as `EINVAL`, so
the same wall would carry two different names depending on your language. Which
Win32 code a given reserved name actually returns, for a given open disposition,
is not something this corpus has executed — see the verification note.

Windows 11 did not repeal this. What changed there is narrower: .NET's
`Path.GetFullPath` no longer rewrites a path that BEGINS with a legacy device
name. The reserved-name list itself is current documentation.

## Workaround

Reject or mangle the closed set at the Windows boundary, matching on the stem
rather than the whole filename:

```js
const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\.|$)/i;
if (RESERVED.test(basename)) throw new Error(`reserved device name: ${basename}`);
```

Put that check in generators, archive extractors, and fixture naming — the three
places that produce filenames nobody typed.

What does not work: adding an extension, moving it into a subdirectory, or
trusting an existence check afterwards. `Test-Path` and `fs.existsSync` can be
answering for the device rather than for a file.

The `\\?\` extended-length prefix disables the path parsing that performs the
device rewrite, which is the documented mechanism — but it applies only to
fully-qualified Unicode paths on APIs that accept it, and Explorer is not
guaranteed to understand what you create that way. Treat it as a targeted escape
hatch, not an application-wide setting.

## Verification note

Quoted from Microsoft's file-naming documentation: the reserved list including
the superscript forms, the "reserved in every directory" statement, the
`NUL.txt` and `NUL.tar.gz` equivalence, and `echo test > COM¹` failing to create
a file.

NOT executed, and therefore stated as inference rather than observation: the
exact Win32 error a given reserved-name open returns and how each runtime maps
it; whether a `\\?\`-prefixed `nul.txt` create produces a real file (the docs
say the prefix disables the parsing that performs the device rewrite, which is
not the same sentence); and whether reading `con.txt` blocks on console input.
This corpus has no Windows host, hence `repro: historical`.

---

`test-path-trailing-whitespace` is the other case where Win32 path parsing
silently rewrites what you asked for. There a trailing space is stripped; here a
whole name is redirected to a device.


---


# Installed a tool, still 'not found' — your session's PATH is a snapshot

## Symptom

An installer runs `winget install node` (or similar), the install succeeds, and
the very next line — `node --version` — fails with "not recognized". The user
opens a NEW terminal and it works. Agents retry the install in a loop.

## Repro

```powershell
winget install OpenJS.NodeJS ; node --version
# 'node' is not recognized as the name of a cmdlet...
# New terminal: node --version → works.
```

## Cause

Installers write PATH to the REGISTRY (Machine/User scope). `$env:Path` is a
process-creation snapshot of that merge — it never refreshes itself. Everything
the current session spawns inherits the stale copy, so the just-installed tool
is invisible until a new process re-reads the registry.

## Workaround

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')
```

Re-merge from the registry after any install step (the referenced installer does
exactly this between winget and the first node call). Scope-read before writing,
per envpath-pollutes-user — the two traps are mirror images.


---


# the port is still busy after your server exited, because Windows keeps TCP state the dead socket left behind and SO_REUSEADDR does not clear it

## Symptom

Your server exits cleanly and the next start cannot bind:

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:8080
```

No process holds the port. `tasklist` shows nothing, you killed the tree, the
handles are closed. Waiting a minute or two fixes it, which is the tell — and so
is the fact that a restart loop in CI fails while a human retrying by hand
succeeds.

You reach for `SO_REUSEADDR`, because that is what fixes this on Linux. Your
runtime will not let you — and that refusal is deliberate.

## Repro

Stop a server that had a live client connection, then immediately look at what is
left:

```
C:\> netstat -ano -p tcp | findstr :8080
  TCP    127.0.0.1:8080     127.0.0.1:52144    TIME_WAIT       0
```

PID `0`: no process owns it. The row is kernel-side connection state, and a new
bind on the same local endpoint is refused while it exists.

## Cause

A closed socket does not immediately free its endpoint. The kernel keeps a
Transmission Control Block for it — `TIME_WAIT` after an active close, plus other
lingering states — so late packets from the old connection cannot reach a new
one. That much is standard TCP and happens everywhere.

What differs is the escape hatch, and the difference is worse than "it does not
work". Windows `SO_REUSEADDR` DOES let you bind over a `TIME_WAIT` — and it also
lets you bind over a port another process is actively listening on, hijacking it.
The two behaviors are the same option. That is why runtimes refuse to set it for
you: libuv's Windows implementation says so directly in its bind path, because
enabling it to solve your restart problem would let any process steal any
listener.

The adjacent option is not a workaround either. `SO_EXCLUSIVEADDRUSE` exists to
prevent that hijacking, and it makes the `TIME_WAIT` case strictly worse: a bind
fails even for endpoints only lingering state occupies.

So the honest summary is that Windows gives you a choice between a security hole
and your current problem, and your runtime already chose for you.

## Workaround

Delete the leftover state explicitly. Win32 exposes it through `SetTcpEntry` with
the row's state set to `MIB_TCP_STATE_DELETE_TCB` (12), which tears down the TCB
for a specific four-tuple:

```go
// iphlpapi.dll SetTcpEntry, MIB_TCPROW{State: 12, LocalAddr, LocalPort, RemoteAddr, RemotePort}
row := mibTCPRow{State: 12, LocalAddr: local, LocalPort: lp, RemoteAddr: remote, RemotePort: rp}
setTCPEntryProc.Call(uintptr(unsafe.Pointer(&row)))
```

Two limits worth knowing before you build on it. It needs administrator rights,
and the structure is IPv4-only — there is no IPv6 equivalent that safely
represents the row, so a dual-stack listener can only ever have half its leftovers
cleared this way.

Because of those limits, the durable answer is usually to stop needing the exact
port on the next start: bind port 0 and publish the assigned port, or use a small
candidate range with fallback. That turns a hard failure into a startup detail.

`SO_LINGER` with a zero timeout avoids creating the state in the first place, by
sending an RST instead of a clean close — but it is a decision the CLOSING side
makes before closing, not something you can apply to a port already stuck, and it
discards unsent data.

If you enumerate rows to find what to delete, read them structurally rather than
by scraping `netstat` output — that text is localized, and matching English state
words is its own trap.

---

`unlink-while-open-ebusy` is the file-handle version of "the resource outlives
the process". This is the socket version, and it is worse in one specific way:
there is no handle to close and no process to kill, so every technique that fixes
the file case does nothing here.


---


# Test-Path says True for a path with trailing whitespace that Node cannot open

## Symptom

A path passes validation in PowerShell and then does not exist for the tool you
hand it to. Same string, same machine, same moment.

```
PowerShell Test-Path:   True
PowerShell Get-Content: data
node existsSync:        false
```

Because PowerShell *reads the file successfully*, the validation step you added
to catch bad paths is the thing that certifies the broken one.

## Repro

A path carrying trailing whitespace, the way real data does — read from a
manifest, a CSV column, a tool's stdout:

```powershell
[IO.File]::WriteAllText("$env:TEMP\real.txt", "data")
[IO.File]::WriteAllText("$env:TEMP\list.txt", "$env:TEMP\real.txt ")   # note the space

$p = Get-Content "$env:TEMP\list.txt"
$p.Length                      # 43
[int][char]$p[-1]              # 32   <- a real space, still attached

Test-Path $p                   # True
Get-Content $p                 # data

node -e "console.log(require('fs').existsSync(process.argv[1]))" $p
# false
```

A trailing dot behaves the same way:

```powershell
Test-Path "$env:TEMP\real.txt."   # True
```

## Cause

Win32 path normalization strips trailing spaces and dots before the filesystem
call, so `"file.txt "` and `"file.txt."` both resolve to `file.txt`. PowerShell's
providers go through that normalization; `Test-Path` and `Get-Content` therefore
succeed.

Runtimes that pass the string closer to the raw API — Node's `fs`, and many
cross-platform toolchains that treat the path as an opaque byte string — do not
get that courtesy, and correctly report that no such file exists.

So the disagreement is not a bug in either one. It is two different definitions
of what the path *is*, and PowerShell's definition is the more forgiving one,
which is exactly why it hides the problem instead of surfacing it.

## Why this shape happens constantly

The trailing character almost never comes from a human typing it. It arrives from:

- a manifest or config line with an accidental space before the newline
- a CSV column that was padded
- a tool's stdout captured without trimming
- a here-string or template where the path sits before a line break

In every one of those, PowerShell validates it, and the failure lands in the
consumer — often a different process, a different language, and a stack trace
that says the file does not exist while you are staring at proof that it does.

## Workaround

```powershell
$p = (Get-Content "$env:TEMP\list.txt").Trim()
node -e "console.log(require('fs').existsSync(process.argv[1]))" $p
# true
```

Trim every path that came from data rather than from a literal, at the boundary
where it enters your script. And do not trust `Test-Path` as a cross-tool
contract — it answers for PowerShell's normalization rules, not for the consumer's.

When a path must survive a handoff, normalize it explicitly:

```powershell
$p = [IO.Path]::GetFullPath($p.Trim())
```

---

Nothing in the archive covers path normalization differences. The nearest
neighbours (`session-path-stale`, `envpath-pollutes-user`) are about `PATH`
the environment variable, not about a filesystem path validating in one runtime
and vanishing in the next.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.


---


# npm update fails with EBUSY because your server exited hours ago but its child process still holds the file

## Symptom

A routine operation on a directory fails, and the error blames the filesystem for
something you did not do:

```
npm error code EBUSY
npm error syscall rename
npm error EBUSY: resource busy or locked
```

Deleting a build directory, replacing a binary, updating a global package,
cleaning a temp folder — all of them hit it. Rebooting fixes it, which tells you
it is a lock and tells you nothing about whose.

The usual culprit is a process you believe is dead. You pressed Ctrl+C on the
parent; the parent exited; a child it spawned is still running and still has the
file open.

## Repro

```powershell
PS> $f = [IO.File]::Open("$PWD\held.txt", 'Create', 'Write', 'None')
PS> Remove-Item held.txt
Remove-Item : The process cannot access the file 'held.txt' because it is being used by another process.
PS> $f.Close()          # now it deletes
```

On Linux or macOS the same sequence succeeds: the directory entry disappears
immediately and the bytes stay alive for the holder until it closes.

To find the holder:

```powershell
PS> Get-Process | Where-Object { $_.Modules.FileName -like "*held*" }
# or, for handles rather than modules, Sysinternals handle.exe -a held.txt
```

## Cause

POSIX unlink removes a name, not a file. The inode survives until the last
descriptor closes, so a running process never blocks a delete or a rename.

Windows file locking is MANDATORY, not advisory. A handle opened without
`FILE_SHARE_DELETE` — which is the default in every high-level runtime API,
including Node's `fs.open` and .NET's `File.Open` — makes the OS refuse deletes
and renames for as long as that handle lives. The refusal comes back as `EBUSY`
for a rename and `EPERM` for an unlink, neither of which names the holder.

Two things make it worse than a plain "close your files" problem:

1. A signal handler that calls `process.exit()` synchronously does not give
   sockets, database handles, or child processes time to close. The parent
   vanishes; the handles do not.
2. Windows has no process groups in the POSIX sense, so killing a parent does not
   kill what it spawned. `Ctrl+C` reaches the console group; a detached child does
   not get it, and an orphaned grandchild never does.

That second point is why the lock outlives everything you can see in a task list
you skim.

## Workaround

Make shutdown release handles before the process leaves, and kill the whole tree:

```js
const GRACE_MS = 3000;
for (const sig of ["SIGINT", "SIGTERM", ...(isWin ? ["SIGBREAK"] : ["SIGHUP"])]) {
  process.on(sig, async () => {
    const force = setTimeout(() => process.exit(0), GRACE_MS).unref?.();
    await server.close();          // drain connections
    await db.close();              // release the sqlite handle
    killProcessTree(child.pid);    // taskkill /PID <pid> /T /F on Windows
    process.exit(0);
  });
}
```

`SIGBREAK` matters: Ctrl+Break is a distinct signal on Windows, and a handler
registered only for `SIGINT` leaves the server orphaned when a user presses it.

When you must delete a path that something may hold, retry with backoff rather
than failing on the first `EBUSY` — antivirus and the search indexer take
transient handles on files you just wrote, and those clear on their own within a
second or two.

---

This is the file-lifetime half of the Windows process model.
`startup-artifact-is-not-a-process` is the liveness half: no supervisor owns your
process. Here, no unlink semantics free your file.


---


# a WindowsApps alias on PATH spawns EPERM while passing every readability and reparse-point probe

## Symptom

A tool installed from the Microsoft Store (or any app that ships an execution
alias) is on PATH, and spawning it fails with `EPERM` — not `ENOENT`. cmd.exe
says "Access is denied." Running the same name interactively works fine.

`EPERM` sends you hunting for a permissions or antivirus problem. There isn't one.

## Repro

```js
// PATH contains C:\Program Files\WindowsApps\...\codex.exe
const { spawnSync } = require("node:child_process");
const p = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_.../codex.exe";

require("node:fs").accessSync(p, require("node:fs").constants.R_OK); // OK
require("node:fs").accessSync(p, require("node:fs").constants.X_OK); // OK
require("node:fs").lstatSync(p).isSymbolicLink();                    // false

spawnSync(p, ["--version"]).error.code;                              // EPERM
```

Measured on Windows 11 with the Codex desktop app installed. The file is
**readable**, passes **X_OK**, is **not a reparse point**, and reports a real size
(297 MB) — and `CreateProcess` still refuses it.

## Cause

Store-packaged apps expose an *app execution alias*. The shell knows how to
activate the package behind it; a direct `CreateProcess` does not, and the
refusal surfaces as `EPERM`.

The nasty part is the detection story. Every heuristic that sounds right fails:

| Probe | Result | Useful? |
|---|---|---|
| `existsSync` | true | no |
| `access(R_OK)` | passes | no |
| `access(X_OK)` | passes | no |
| `lstat().isSymbolicLink()` | false | no |
| size looks like a stub | 297 MB | no |

The advice you find online — "skip unreadable reparse points" — does not catch
this binary at all. The only reliable discriminator is the `WindowsApps` **path
segment itself**.

## Workaround

Filter the PATH walk by whole path segment, and keep a shell hop as the fallback,
since the shell *can* start the alias:

```js
const isStoreAlias = (p) => /(^|[\\/])WindowsApps([\\/]|$)/i.test(p);
```

Match it as a whole segment so a directory named `MyWindowsAppsBackup` is not
swept up. Ladder that worked: explicit override env var, then a PATH/PATHEXT walk
that skips WindowsApps, then a caret-escaped `cmd.exe` hop.

## Real-world hit

lidge-jun/codexclaw#33 — a trust-registration command died here on every run, and
because the failure was in a *verification* step the tool rolled back a write that
had actually succeeded.
Fix: https://github.com/lidge-jun/codexclaw/commit/071eb40


---


# your ACL hardening fails on a WSL path because a wsl.localhost UNC root has no NTFS security descriptor to harden

## Symptom

A routine that locks down directories — a sandbox setting deny-write roots, an
installer securing a config directory — fails only for users who work inside WSL:

```
\\wsl.localhost\Ubuntu\home\me\project: Access is denied.
```

The path exists. Explorer opens it. `dir` lists it. Elevation does not help, and
neither does taking ownership, because there is nothing there to own.

## Repro

```
C:\> dir \\wsl.localhost\Ubuntu\home\me
 Directory of \\wsl.localhost\Ubuntu\home\me
 ... lists normally ...

C:\> icacls \\wsl.localhost\Ubuntu\home\me
 ... the security operation does not apply to this provider ...
```

The path reads and lists like any other, and the security call is the one that
refuses. Four spellings reach the same store — `\\wsl.localhost\`, the older
`\\wsl$\`, and both under the extended-length `\\?\UNC\` prefix — which is why
a skip list has to cover all four.

## Cause

`\\wsl.localhost\...` is a UNC path served by the WSL 9P filesystem provider, not
by NTFS. Its backing store is a Linux filesystem with POSIX mode bits and no
Windows security descriptors, so there is no DACL for `icacls` or
`SetNamedSecurityInfo` to read or write. The refusal is the provider correctly
reporting that the operation does not apply.

The general rule this instance teaches: on Windows, "it is a path" does not imply
"it supports the filesystem operations you know". A UNC path may be served by a
provider with entirely different semantics — WSL's 9P, a WebDAV mount, a network
redirector — and the ones that matter here fail on security operations rather
than on reads.

POSIX has no equivalent trap because a mount either supports an operation or
returns a clear `ENOTSUP`, and permission bits exist everywhere. Here the error
is `Access is denied`, which reads as a permissions problem and sends you toward
elevation — the one thing that cannot possibly help.

## Verification note

The originating commit (openai/codex `8a2bc6d9`) unit-tests the prefix matching;
it does not contain a captured `icacls` transcript, and none was produced in this
loop. What is documented independently is the architecture: WSL2 serves
`\\wsl.localhost` and `\\wsl$` through a 9P redirector backed by a Linux
filesystem, which has POSIX mode bits and no Windows security descriptors. The
exact error text a given ACL call returns, and whether WSL1's VolFs behaves
identically, are NOT established here — WSL1 uses a different provider. Hence
`repro: historical`.

## Workaround

Detect the roots that cannot carry ACLs and skip them rather than failing:

```rust
fn is_acl_unsupported_root(path: &Path) -> bool {
    let key = canonical_path_key(path);   // lowercased, forward slashes
    key.starts_with("//wsl.localhost/")
        || key.starts_with("//wsl$/")
        || key.starts_with("//?/unc/wsl.localhost/")
        || key.starts_with("//?/unc/wsl$/")
}
```

Canonicalize before matching — all four prefixes are the same root, and casing
varies — and treat the skip as a REPORTED outcome rather than a silent one. A
directory you meant to harden and could not is a security fact the caller should
see, even though failing the whole run would be worse.

Do not attempt to substitute POSIX permissions through WSL. The Windows-side
process cannot set them meaningfully, and a `chmod` through interop introduces a
dependency on a running distribution.

---

`icacls-inheritance-r-empty-dacl` is about getting the ACL sequence wrong on a
filesystem that has ACLs. This is the case where the filesystem has none at all,
and the tell is that elevation changes nothing.


---


# WSLENV is shared with the Windows side by design, so the env var everyone reaches for to detect WSL cannot detect it

## Symptom

Code that branches on "am I in WSL" takes the WSL branch on a native Windows
machine. Everything downstream is then wrong in a quiet way: paths get translated
that should not be, a POSIX tool is preferred over its Windows build, an installer
refuses to run because it thinks it is in the wrong environment.

Nothing errors. The detection function returns a confident, wrong answer.

## Repro

`WSLENV` is the variable you configure to pass other variables across the
boundary, so on a machine where anyone has set it up, it is readable from the
Windows side:

```powershell
PS> setx WSLENV "MYTOOL_HOME/p"      # ordinary interop setup, done once
PS> $env:WSLENV                       # in a new native-Windows shell
MYTOOL_HOME/p
```

And the common check is now true in the environment it was written to exclude:

```js
const isWsl = Boolean(process.env.WSLENV);   // true, on native Windows
```

The variable is not present on every Windows box — it appears once interop is
configured. That is exactly what makes it a bad test: it is absent on the clean
machine you develop on and present on the user's, so the branch flips based on
setup you never see.

## Cause

`WSLENV` is not a WSL marker. It is the interop CONFIGURATION variable: it lists
which environment variables are translated when crossing between Windows and
Linux, and in which format. Microsoft documents it as shared between the two
environments, which is the whole point — it has to be readable from the Windows
side to do its job there.

Two other habits fail for related reasons. `/proc/version` containing "microsoft"
is a genuine Linux-side marker but is unreadable from a win32 process, so code
that tries it first and falls through to an env check inherits the env check's
bug. And `WSL_DISTRO_NAME` and `WSL_INTEROP` are real Linux-side markers, but any
process that inherits an environment across the boundary can carry them.

## Workaround

Let the runtime's own platform decide first, and only consult WSL markers when it
says Linux:

```js
function platformKind() {
  if (process.platform === "win32") return "windows-native";  // no WSL branch, ever
  if (process.platform !== "linux") return process.platform;
  const wsl = process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP
    || readFileSafe("/proc/version").toLowerCase().includes("microsoft");
  return wsl ? "wsl" : "linux";
}
```

`process.platform` cannot lie about which kernel is running the process, which
makes it the only trustworthy first gate. Keep `WSLENV` out of the decision
entirely; it tells you interop is configured, not where you are.

A related trap worth handling in the same function: a Windows Node launched from
inside WSL reports `win32` and gets a UNC working directory
(`\\\\wsl.localhost\\...`), so key that case on the cwd rather than on the
environment.

---

`env-domain-principal` is the other case where an environment variable is treated
as identity. This one is narrower and nastier: the variable is genuinely set by
the system, genuinely related to WSL, and still the wrong thing to test.
