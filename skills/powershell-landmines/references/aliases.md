
# command -v silently reports every tool as missing

## Symptom

An agent (or a ported bash script) probes for a tool with `command -v foo` under
PowerShell. The probe prints nothing and the script concludes the tool is
missing — even though it is installed and on PATH. Installs get re-run,
bootstraps loop, "missing dependency" errors lie.

## Repro

```powershell
command -v git      # prints nothing, no error, $? stays true
Get-Command git     # works: CommandType Application, path shown
```

## Cause

PowerShell has no `command` builtin. Depending on parse context, `command -v git`
either matches nothing quietly or binds to unrelated tokens; it raises no error
and sets no useful exit state. The bash idiom fails in the WORST way: silently,
with a plausible-looking negative result.

## Workaround

- Probe with `Get-Command <tool> -ErrorAction SilentlyContinue` (null check) or
  simply run `<tool> --version` and check `$LASTEXITCODE`.
- Agent prompts targeting Windows must map `command -v` → `Get-Command`; the
  referenced commit ships that rule as a documented shell-hazard contract.


---


# npm's .ps1 shim wins the PATH race and nothing can run it

## Symptom

Tool detection finds "npm" but every attempt to execute it fails: cmd.exe says
it can't run the file, spawn calls error out, or execution policy blocks it.
Meanwhile `npm.cmd` sits right next to it, working fine.

## Repro

```powershell
# npm installs THREE shims side by side: npm, npm.cmd, npm.ps1
Get-Command npm     # PowerShell may resolve npm.ps1 first
# cmd.exe /c npm.ps1  → not executable via ComSpec
# Restricted policy   → npm.ps1 blocked entirely
```

## Cause

npm ships `tool`, `tool.cmd`, and `tool.ps1` shims. `Get-Command` and PATHEXT
resolution can select the `.ps1`, which (a) execution policy may block, (b)
cmd.exe/ComSpec cannot execute, and (c) CreateProcess cannot launch directly.
The extensionless file is a POSIX sh script — equally unrunnable natively.

## Workaround

- Resolve explicitly in preference order `.exe` > `.cmd`, never `.ps1`:
  `Resolve-CommandPath @('npm.cmd','npm.exe','npm')` or
  `Get-Command npm -CommandType Application`.
- In spawn logic, treat `.ps1` as non-launchable (needs an interpreter);
  the referenced fix rejects it even when PATHEXT lists it.


---


# curl silently becomes Invoke-WebRequest

## Symptom

A script or coding agent runs `curl -s -o out.json https://api.example.com` under
Windows PowerShell and gets a parameter-binding error, a prompt hanging on input, or
an HTML-ish object instead of a file. The error mentions `Invoke-WebRequest`
parameters, not curl — which sends you debugging the wrong tool.

## Repro

```powershell
# Windows PowerShell 5.1
Get-Command curl          # -> Alias  curl -> Invoke-WebRequest
curl -s https://example.com
# Invoke-WebRequest : Parameter cannot be processed because the parameter name 's'
# is ambiguous. Possible matches include: -SessionVariable -SkipCertificateCheck ...
```

Observed live: an AI agent driving a Slack integration issued `curl` for an API
round-trip; PowerShell resolved the alias, the flags bound to Invoke-WebRequest
parameters, and the call failed with an error that pointed nowhere near the cause.

## Cause

Windows PowerShell 5.1 ships `curl` and `wget` as built-in aliases for
`Invoke-WebRequest`. An upstream attempt to remove them (PR #1901) was closed
unmerged for compatibility; 5.1 keeps the aliases forever. PowerShell 7 removed
them on all platforms, so the same command behaves differently across versions.

## Workaround

- Call `curl.exe` explicitly — the `.exe` suffix bypasses alias resolution.
- Or use `Invoke-RestMethod`/`Invoke-WebRequest` with native parameters on purpose.
- Agent system prompts targeting Windows should ban bare `curl`/`wget`.
