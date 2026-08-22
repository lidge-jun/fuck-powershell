---
title: "the folder API you use to find AppData returns an empty string instead of failing, so a redirected profile silently gives you the filesystem root"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "known folder empty not error"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#env-derived-identity">env-derived-identity</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, powershell 51, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">env derived identity</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">known folder api</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/35>
- <https://github.com/lidge-jun/opencodex/commit/9122d5ebee7e0d1521cdf8bbb86654fd14d7faa9>
