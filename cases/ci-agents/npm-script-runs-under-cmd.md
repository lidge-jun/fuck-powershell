---
id: npm-script-runs-under-cmd
title: "your npm script is a bash one-liner everywhere and a literal filename on Windows, so the release silently ships without its Windows artifact"
category: ci-agents
versions: "both"
failure: misleading-error
context: [ci, script]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/ddb347bf1421bff6f5ea7591d8582a83d264929a
ontology:
  affects: [shell-cmd, env-windows, env-actions-runner]
  invokes: [command-npm, command-cmd]
  manifests_as: [error-command-not-recognized]
  caused_by: [mechanism-default-shell-selection]
  mitigated_by: [workaround-node-script-not-shell]
---

# your npm script is a bash one-liner everywhere and a literal filename on Windows, so the release silently ships without its Windows artifact

## Symptom

A `package.json` script that has worked for years fails only on the Windows leg of
a release matrix, and the error names a file nobody wrote:

```
PYTHON: cannot open file D:\a\proj\proj\=$(bash ../scripts/pick-python.sh)
```

The path is your command substitution, verbatim, treated as a filename. Because
the macOS and Linux legs still pass, the release itself reports success and only
the Windows artifact goes missing — sometimes for several versions before anyone
notices.

## Repro

```json
{ "scripts": { "build": "node $(node -p \"'app.js'\")" } }
```

```
PS> npm run build
Error: Cannot find module 'D:\proj\$(node'
```

```
$ npm run build     # macOS / Linux — runs app.js
```

The substitution is neither expanded nor rejected: its literal text becomes an
argument. That is what makes the real-world version confusing, because the
complaint comes from whatever program received the text:

```
PYTHON: cannot open file D:\a\proj\proj\electron\=$(bash ../scripts/pick-python.sh)
```

There `PYTHON="$(bash ...)"` was meant as an environment prefix. Nothing expanded,
so `PYTHON` resolved through PATHEXT to `python.exe` and the remainder of the line
arrived as a filename to open.

## Cause

npm does not run scripts in a shell of your choosing. On POSIX it uses `/bin/sh`;
on Windows it uses cmd.exe. POSIX shell features you use without thinking are
simply absent there:

- `$(...)` command substitution — not expanded, passed through as text.
- single quotes as a quoting mechanism — cmd.exe treats them as literal characters.
- `VAR=value cmd` inline environment prefixes — that one has its own case,
  `cmd-posix-env-prefix`. It compounds with this one: a prefix whose value is a
  substitution fails on both counts at once, which is exactly the release-lane
  failure above.

Which interpreter you get is npm's `script-shell` config, and its Windows default
is cmd.exe specifically — not `%ComSpec%`. Repointing ComSpec at PowerShell does
not change `npm run`; only `script-shell` does. Node's own `shell: true` is the
one that follows ComSpec, which is a different trap in the same neighborhood.

What makes this a release-killer rather than an annoyance is where it lands. The
failing script is usually a per-platform `dist:win` entry that only executes on
the Windows runner, so it cannot fail during local development or in a pull
request that builds one OS.

## Workaround

Move logic out of the script string and into a file the runtime can execute
directly:

```json
{ "scripts": { "build": "node scripts/build.mjs" } }
```

Compute environment variables inside that program rather than prefixing them in
the script line. When a script genuinely must be shell, name the shell explicitly
(`"build": "bash scripts/build.sh"`) and accept the Git-Bash dependency, or set
`script-shell` in `.npmrc` — but note that changes it for every script and every
contributor.

A contract test that walks `scripts` and rejects `$(`, `&&` chains with inline
env, and single-quoted arguments costs ten lines and catches the next one at PR
time instead of release time.

---

`cmd-posix-env-prefix` covers the inline `VAR=value` prefix specifically.
`actions-default-shell` covers the CI runner's default shell. This case is the
package-manager layer between them: the script string you wrote is handed to a
different interpreter based on the host, and `npm run` never says so.
