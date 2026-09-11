**Category:** env-paths · **Versions:** both · **Failure:** silent · **Context:** interactive, script, agent · **Source:** first-party · **Repro:** verified

## Symptom

A tool's installer puts a stable "current" directory on PATH and points it at the
versioned payload with a junction. The tool is installed, the junction exists, the
target directory exists and holds the executable — and the command is not found.

```
PS> Get-Command aside -All
PS>                                  # nothing. no error, no output.
PS> Test-Path "$env:LOCALAPPDATA\Aside\CLI\current\aside.exe"
False
PS> cmd /c dir "%LOCALAPPDATA%\Aside\CLI\current"
 Directory of C:\Users\me\AppData\Local\Aside\CLI\current
File Not Found
```

Every probe agrees the directory is empty, so the natural conclusion is that the
install is broken or the version folder was cleaned up. It was not. The payload is
right there:

```
PS> Get-ChildItem "$env:LOCALAPPDATA\Aside\CLI\versions\1.26.906.1630"
aside.exe        (123 MB)
```

Nothing anywhere raises an error. A PATH entry that resolves to an empty directory
is not an error condition — it is just a directory with no matches in it.

## Repro

The junction looks fine until you ask what is actually recorded in it:

```
PS> cmd /c dir /AL "%LOCALAPPDATA%\Aside\CLI"
09/10/2026  08:46 PM    <JUNCTION>   current [\??\C:\Users\me\AppData\Local\Aside\CLI\versions\1.26.906.1630]
```

That bracketed name is the tell. `dir` prints the print name when there is one and
falls back to the substitute name when there is not, and a substitute name is in
the NT object namespace, hence the `\??\` prefix. Read the reparse buffer directly:

```
PS> fsutil reparsepoint query "$env:LOCALAPPDATA\Aside\CLI\current"
Reparse Tag Value : 0xa0000003
Tag value: Mount Point
Substitue Name offset: 0
Substitue Name length: 130
Print Name offset:     132
Print Name Length:     0
Substitute Name:       \??\C:\Users\me\AppData\Local\Aside\CLI\versions\1.26.906.1630
```

`Print Name Length: 0`.

Control — a junction to the exact same target, created by `mklink /J`:

```
PS> cmd /c mklink /J "$env:TEMP\ctl" "$env:LOCALAPPDATA\Aside\CLI\versions\1.26.906.1630"
PS> fsutil reparsepoint query "$env:TEMP\ctl"
Substitue Name length: 130
Print Name Length:     122
Substitute Name:       \??\C:\Users\me\AppData\Local\Aside\CLI\versions\1.26.906.1630
Print Name:            C:\Users\me\AppData\Local\Aside\CLI\versions\1.26.906.1630
PS> Test-Path "$env:TEMP\ctl\aside.exe"
True
```

Same tag, same substitute name, same target. The only difference is the print name,
and only the one with a print name can be traversed.

## Cause

A mount-point reparse point carries two names: a **substitute name** in the NT
object namespace (`\??\C:\...`), which is what the object manager follows, and a
**print name** in Win32 form (`C:\...`), which exists so tools can display and
re-resolve it. `mklink /J` and the shell write both. Code that builds the
`REPARSE_DATA_BUFFER` by hand frequently writes only the substitute name and leaves
the print-name length at zero, because the substitute name is the one the kernel
follows and a quick test on the creating machine appears to work.

It does not survive contact with the Win32 path layer. Path resolution through the
junction — enumeration, `Test-Path`, PATH search, `dir` — goes through code that
wants the Win32 name, gets a zero-length string, and resolves to nothing. There is
no error path for "this directory has no entries", so every caller reports an empty
directory and moves on.

POSIX has no analogue because a symlink has exactly one target string. There is no
second, cosmetic copy of the path that the rest of the system quietly depends on.

## Workaround

Never trust a vendor-created junction on PATH. Resolve the versioned directory
yourself and keep the junction as a hint, not a source of truth:

```powershell
$exe = Join-Path $env:LOCALAPPDATA 'Aside\CLI\current\aside.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  $exe = Get-ChildItem "$env:LOCALAPPDATA\Aside\CLI\versions\*\aside.exe" |
         Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
}
```

To diagnose one, `fsutil reparsepoint query` is the only probe that answers the real
question. `Get-Item` reports `LinkType: Junction` and a correct-looking `Target`
for the broken junction too, because it reads the substitute name — so the
PowerShell-native inspection is exactly the one that will tell you everything is fine.

If you own the creating code, write both names, or just call `mklink /J` /
`CreateSymbolicLink` and let Windows build the buffer.

Do not "fix" it by deleting and recreating the junction as part of a tool's startup
unless you are that tool's installer — it is a shared path and another version of
the app may be mid-install.

---

`windowsapps-alias-eperm` is the neighbouring shape: there a PATH entry resolves to
something that exists and fails at spawn with a misleading error. Here the PATH
entry resolves to nothing at all and no error is produced, so the tool is simply
absent. `session-path-stale` and `path-dot-hijacks-bare-npm` are about which PATH
entry wins; this one is about an entry that silently contains nothing.

