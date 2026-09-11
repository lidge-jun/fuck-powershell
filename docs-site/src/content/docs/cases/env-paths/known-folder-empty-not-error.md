---
title: "the folder API you use to find AppData returns an empty string instead of failing, so a redirected profile silently gives you the filesystem root"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "known folder empty not error"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#absent-folder-empty-result">absent-folder-empty-result</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, powershell 51, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">absent folder empty result</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">known folder api</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/35>
- <https://github.com/lidge-jun/opencodex/commit/9122d5ebee7e0d1521cdf8bbb86654fd14d7faa9>
