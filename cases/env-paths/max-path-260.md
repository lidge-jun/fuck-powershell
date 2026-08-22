---
id: max-path-260
title: "the 260-character path limit is still there, the registry switch alone does not lift it, and the tree you created may be one nothing can delete"
category: env-paths
versions: "both"
failure: hard-error
context: [script, ci, agent]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/40
  - https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation
  - https://learn.microsoft.com/en-us/windows/win32/sbscs/application-manifests
  - https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew
ontology:
  affects: [env-windows, runtime-node, runtime-python, env-win32-api]
  manifests_as: [error-enametoolong]
  caused_by: [mechanism-max-path-ceiling]
  mitigated_by: [workaround-long-path-optin]
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
