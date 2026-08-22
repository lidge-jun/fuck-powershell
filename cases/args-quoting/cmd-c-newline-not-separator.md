---
id: cmd-c-newline-not-separator
title: "a newline inside cmd /c does not start a second command, so the half of your script after it never runs"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent, ci]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/45
  - https://github.com/openai/codex/commit/1f0fe5b8
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd]
  caused_by: [mechanism-statement-terminator]
  mitigated_by: [workaround-ampersand-separator]
---

# a newline inside cmd /c does not start a second command, so the half of your script after it never runs

## Symptom

You build a two-line script, hand it to `cmd.exe /c`, and the second line silently
does not run. The exit code is 0, because the first line succeeded.

The version that costs you a day: line one sources an environment file and line
two dumps the environment. The dump never happens, so you get an empty or stale
environment back and go hunting through your parser for a bug that is not there.

## Repro

```js
const { execFileSync } = require("node:child_process");

execFileSync("cmd.exe", ["/c", "echo first\r\necho second"], { encoding: "utf8" });
// "first" only — "echo second" is consumed as arguments to the first echo

execFileSync("cmd.exe", ["/c", "echo first & echo second"], { encoding: "utf8" });
// "first" and "second"
```

The POSIX habit that fails:

```sh
sh -c 'echo first
echo second'          # both run
```

## Cause

`cmd.exe /c` takes ONE command line, not a script. Everything after `/c` is a
single line to parse, and a newline in the middle of it is just a character — it
is not a statement terminator, so the text after it becomes more arguments to
whatever the line already started.

That is a real asymmetry inside cmd.exe itself, not a general rule about Windows:
a `.bat` or `.cmd` FILE is a script, and newlines separate statements there
normally. So the same text works when you write it to a file and fails when you
pass it inline, which is what makes the behavior feel arbitrary.

`sh -c` accepts a whole program, which is why the pattern gets written this way in
cross-platform code in the first place — it is correct on the POSIX branch and the
Windows branch inherits its shape.

## Workaround

Join with `&`, or `&&` when the second command should only run on success:

```js
const line = ["if exist \"%F%\" call \"%F%\" >nul 2>&1", "set"].join(" & ");
execFileSync("cmd.exe", ["/c", line], { encoding: "utf8" });
```

Two details that bite after the fix. Redirection binds to the command it follows,
so `>nul 2>&1` must sit before the `&` that ends its command rather than at the
end of the whole line. And `&` inside a QUOTED argument is data, not a separator,
so a value containing `&` will not accidentally split — which is the same
mechanism that makes `shell: true` dangerous when the value is untrusted.

When the script is genuinely long, write a `.cmd` file and run that. Then newlines
behave the way you expected, and you get comments and labels as a bonus.

---

`cmd-start-ampersand-splits` is this mechanism from the other side: there an `&`
in data splits a command you meant to keep whole. Here a newline that should have
split one silently does not.
