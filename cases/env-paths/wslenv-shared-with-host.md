---
id: wslenv-shared-with-host
title: "WSLENV is shared with the Windows side by design, so the env var everyone reaches for to detect WSL cannot detect it"
category: env-paths
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/4a2bbefd2ca71328dab787e6fad88776d1b9381f
ontology:
  affects: [env-windows, runtime-node]
  caused_by: [mechanism-env-derived-identity]
  mitigated_by: [workaround-platform-first-classification]
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
