
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


---


# icacls /inheritance:r before the grant leaves a file with no ACEs at all, and you cannot repair it because repairing needs access you just removed

## Symptom

A hardening routine that locks down a secrets file half-runs — a timeout, a
transient failure, a killed CI job — and afterwards nobody can touch the file:

```
Access is denied.
```

You own it. `dir` shows it. You cannot read it, cannot delete it, and cannot
re-run the hardening script, because that script's first act is another
`icacls` call and `icacls` needs access too. The state is not recoverable by
retrying, which is what makes it worse than a plain failure.

## Repro

The dangerous order, interrupted after the first step:

```
C:\> icacls secret.txt /inheritance:r
processed file: secret.txt

C:\> type secret.txt
Access is denied.

C:\> del secret.txt
Access is denied.
```

The file now has an owner and an empty DACL. On POSIX, `chmod 000` looks similar
and is not: the owner can always `chmod` it back, because ownership carries the
right to change the mode.

Recovery on Windows needs an ownership-based repair, which is a different command
than the one that broke it:

```
C:\> icacls secret.txt /grant "%USERNAME%":(F)
```

That works only because `WRITE_DAC` is implied by ownership — but any script that
assumed it could just re-run its hardening sequence is stuck.

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
icacls "%TARGET%" /grant "%USERNAME%":(F)          rem 1. keep a way back in
icacls "%TARGET%" /inheritance:r                   rem 2. now safe to strip
icacls "%TARGET%" /remove:g "BUILTIN\Users"        rem 3. drop the rest
```

For a directory, the grant needs the inheritance flags — `(OI)(CI)(F)` — or
children created later inherit nothing.

Design the routine so that failure at any step leaves the target USABLE rather
than merely leaving it unhardened. Unhardened is a security finding you can fix on
the next run; locked-out is a support ticket.

Verify at the end rather than trusting exit codes: `icacls` reports per-file
success lines, and a partially applied ACL can still exit zero on the step that
did run.

---

`env-domain-principal` covers who to name in the grant — the token SID rather
than `USERDOMAIN\USERNAME`. This case is about when to name them: the identity can
be perfectly correct and the order still locks you out.


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

```powershell
PS> $env:USERPROFILE = "C:\nonexistent-profile"
PS> [Environment]::GetFolderPath('LocalApplicationData')

PS> ([Environment]::GetFolderPath('LocalApplicationData')).Length
0
```

And the shape that reaches production:

```js
const base = getLocalAppData();          // "" for a redirected profile
const dir = path.join(base, "myapp");    // "myapp" — relative to cwd, not AppData
```

The POSIX habit that fails here is assuming a lookup either succeeds or throws.
This one has a third outcome.

## Cause

`GetFolderPath(SpecialFolder.LocalApplicationData)` — and the convenience
wrappers layered on it — resolve through the environment, chiefly `USERPROFILE`.
When the profile named there has no AppData directory on disk, the call does not
treat that as an error. It returns an empty string, because "the folder does not
exist" is not the same question as "where would it be".

That is a defensible API contract and a terrible default for callers, since the
empty string is a perfectly valid argument to every path function you will hand
it to. Nothing downstream can tell the difference between "AppData is here" and
"nobody knows".

The environment dependence is the deeper problem: `USERPROFILE`,
`LOCALAPPDATA`, `HOMEDRIVE`, and `HOMEPATH` are all writable by anything in the
process tree, so a value your code treats as an identity is actually inherited
state.

## Workaround

Ask the known-folder registration for the effective token instead of asking the
environment:

```powershell
# SHGetKnownFolderPath, FOLDERID_LocalAppData, KF_FLAG_DEFAULT_PATH (0x400)
$sig = '[DllImport("shell32.dll", CharSet = CharSet.Unicode)] public static extern int ' +
       'SHGetKnownFolderPath(ref System.Guid id, uint flags, System.IntPtr token, out System.IntPtr path);'
Add-Type -MemberDefinition $sig -Name Shell32 -Namespace Win32 | Out-Null
$id = [Guid]'F1B32785-6FBA-4FCF-9D55-7B8E7F157091'
$out = [IntPtr]::Zero
[void][Win32.Shell32]::SHGetKnownFolderPath([ref]$id, 0x400, [IntPtr]::Zero, [ref]$out)
[Runtime.InteropServices.Marshal]::PtrToStringUni($out)
```

`KF_FLAG_DEFAULT_PATH` is what makes it answer whether or not the directory
exists on disk, and a NULL token is what makes it answer for the effective
account. Passing `(HANDLE)-1` is not equivalent — that resolves the built-in
Default profile, a namespace no real account writes to, which turns a wrong
answer into a wrong answer that looks plausible.

Whatever API you settle on, treat an empty result as a hard failure at the
boundary. A path helper that can return `""` should refuse instead, because every
consumer downstream will silently accept it.

---

`env-domain-principal` is the identity version of the same environment
dependence: trusting `USERDOMAIN` and `USERNAME` instead of resolving the token
SID. This is the location version, and it carries an extra hazard — the wrong
answer is empty rather than wrong, so it fails a null check you did not write.


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

```powershell
PS> cd $env:TEMP
PS> $a = 'a' * 240
PS> New-Item -ItemType Directory -Force $a | Out-Null
PS> New-Item -ItemType Directory -Path (Join-Path $a ('b'*240))
# .NET Framework: PathTooLongException (HRESULT 0x800700CE)
# PowerShell 7: IOException wrapping ERROR_FILENAME_EXCED_RANGE (206)
```

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

Every load-bearing claim here is from Microsoft's own documentation, and the
runtime opt-in table is read from each project's source manifest rather than from
a shipped binary. The exception types in the repro are what the documented error
codes map to per runtime; this corpus has no Windows host, so the case is marked
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

When a reserved-name call does fail rather than succeed, the runtime error is a
second layer of confusion: Win32 `ERROR_INVALID_NAME` (123) surfaces as
`ENOENT` in Node and `EINVAL` in Python, so the same wall has two different
names depending on your language.

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

The `COM¹` behavior and the `NUL.txt` equivalence are quoted from Microsoft's
file-naming documentation. The exact errno each runtime reports on a FAILED
reserved-name open, and whether a `\\?\`-prefixed `nul.txt` create produces a
real file, are documented-behavior inferences rather than observed runs — this
corpus has no Windows host, and this case is marked `repro: historical`
accordingly.

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

You already set `SO_REUSEADDR` because that is what fixes this on Linux. It does
not fix it here.

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
lingering states — so late packets from the old connection cannot be delivered to
a new one. That part is standard TCP and happens on every platform.

What differs is the escape hatch. On Linux, `SO_REUSEADDR` means "let me bind
even though a `TIME_WAIT` exists here", which is exactly the permission you want.
On Windows, `SO_REUSEADDR` means something else — roughly "let two sockets share
this endpoint" — and it does not grant the thing you were reaching for. The
POSIX-shaped fix is a no-op for the POSIX-shaped problem.

So the port stays unbindable until the state ages out, and there is no socket
option that shortens the wait.

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

If you do enumerate rows to find what to delete, read them structurally rather
than by scraping `netstat` text — that output is localized, and matching English
state words is its own trap.

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
