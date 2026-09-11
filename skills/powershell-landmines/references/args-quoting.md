---
id: backslash-quote-ends-span
title: "escaping a quote ENDS the quoted span, so one JSON argument silently becomes several"
category: args-quoting
versions: "5.1"
failure: misleading-error
context: [agent, script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/6
ontology:
  affects: [runtime-node, shell-powershell-51, env-windows]
  invokes: [command-node, command-convertto-json]
  manifests_as: [error-invalid-json]
  caused_by: [mechanism-native-argv-rebuild]
  mitigated_by: [workaround-file-payload]
  unsafe_fix: [workaround-escape-more-quotes]
---

# escaping a quote ENDS the quoted span, so one JSON argument silently becomes several

## Symptom

You pass a JSON payload to a CLI as one argument. The tool answers
`invalid JSON` — or worse, silently receives a *different* number of arguments
than you passed. Every escaping trick you try fails a slightly different way, so
it feels like the CLI is broken.

It isn't. Escaping a double quote in PowerShell **ends the quoted region**, so
the first space after it becomes an argument separator.

## Repro

Probe that prints the child's raw argv:

```js
// argv.mjs
const args = process.argv.slice(2);
console.log("argc=" + args.length);
args.forEach((a, i) => console.log(i + ": " + JSON.stringify(a)));
```

```powershell
# A — single quotes: every double quote is eaten
node argv.mjs --attest '{"a":"b"}'
# argc=2 / 1: "{a:b}"                      <- not JSON anymore

# B — backslash-escaped, no space in the value: survives
node argv.mjs --attest '{\"a\":\"b\"}'
# argc=2 / 1: "{\"a\":\"b\"}"                 <- looks like the fix!

# C — same escaping, ONE space in the value: splits
node argv.mjs --attest '{\"a\":\"b c\"}'
# argc=3 / 1: "{\"a\":\"b"  2: "c\"}"          <- one arg became two

# D — control: plain quoted string with spaces is fine
node argv.mjs "b c d"
# argc=1 / 0: "b c d"
```

B is the trap. It works, you ship it, and it breaks the first time a value
contains a space — which for a `--message`, `--body` or `--did` field is
immediately.

## Every "obvious" workaround also fails

```powershell
$j = '{"a":"b c"}'; node argv.mjs --attest $j            # 1: "{a:b c}"   quotes stripped
$j = @'
{"a":"b c"}
'@; node argv.mjs --attest $j                            # 1: "{a:b c}"   here-string does not help
$j = @{a="b c"} | ConvertTo-Json -Compress
node argv.mjs --attest $j                                # quotes stripped too
node argv.mjs --% --attest {"a":"b c"}                   # argc=3, and it swallowed "2>&1" as an argument
```

Building *valid* JSON in PowerShell does not help, because the damage happens
when the argument vector is rebuilt for the native process, after your variable
is correct.

`--%` deserves its own warning: it stops parsing for everything that follows,
so your redirection operators become literal arguments.

## Cause

PowerShell rebuilds a command line for native processes and re-quotes by
heuristic. A backslash-escaped `\"` reaches that rebuilder as a *real* quote
character, which closes the quoted span; the remainder of the value is then
treated as unquoted text and split on whitespace. Single quotes take the opposite
path — the quotes never survive at all.

## Workaround

Use PowerShell's own doubling escape **inside single quotes**:

```powershell
$j = '{""from"":""P"",""did"":""two words here""}'
node -e "console.log(JSON.parse(process.argv[1]))" $j
# -> { from: 'P', did: 'two words here' }     parses correctly
```

Better, avoid argv entirely for structured payloads:

```powershell
# file transport
'{"a":"b c"}' | Set-Content -Encoding utf8 $env:TEMP\p.json
mytool --attest-file $env:TEMP\p.json

# base64 transport, when the tool supports it
$b = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($j))
mytool --attest-b64 $b
```

If you are designing the CLI: ship a `--x-file` flag. On Windows it is not a
convenience, it is the only reliable channel for anything containing a space and
a quote.

---

`oss-native-arg-quoting` documents that quotes get stripped and empty args
vanish. This case is the follow-on that bites *after* you read that one and start
escaping: the escape appears to work, and then silently changes your argument
count the moment a value contains a space. The doubled-quote-inside-single-quotes
workaround is not recorded anywhere in the archive.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.


---

---
id: bun-ps-windowstyle-argv
title: "Bun rejects powershell.exe argv containing -WindowStyle Hidden"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/0a904776160ea2954fbad1276b112f2c06ddfbae
  - https://github.com/lidge-jun/opencodex/commit/393d72a779e92b3116b854d714916704756d8110
ontology:
  affects: [runtime-bun, shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-powershell]
  caused_by: [mechanism-bun-windowstyle-argv-reject]
  mitigated_by: [workaround-create-no-window]
---

# Bun rejects powershell.exe argv containing -WindowStyle Hidden

## Symptom

PowerShell-based SID/process lookups and cleanup routines silently do nothing
under Bun on Windows. No error surfaces in the happy path; the spawn itself
failed before `-Command` ever ran.

## Repro

```js
// Bun 1.3.14, Windows
Bun.spawn(["powershell.exe", "-WindowStyle", "Hidden", "-Command", "whoami"]);
// spawn fails before PowerShell runs (#1589) — remove the -WindowStyle pair:
Bun.spawn(["powershell.exe", "-Command", "whoami"], { windowsHide: true }); // works
```

## Cause

A Bun 1.3.14 Windows spawn bug: the adjacent `"-WindowStyle", "Hidden"` argv
pair to `powershell.exe` makes process creation itself fail. Combined with the
flag being useless for console suppression anyway (see
windowstyle-hidden-vs-windowshide), keeping it in argv is all cost, no benefit.

## Workaround

- Strip `-WindowStyle Hidden` from every direct PowerShell argv; rely on
  `windowsHide: true` (CREATE_NO_WINDOW).
- Script-internal `Start-Process -WindowStyle Hidden` is a different construct
  and remains fine.
- The fix added a sweep test forbidding the argv pair across the codebase.


---

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
// "first" only — the newline ends the command and the remainder is discarded

execFileSync("cmd.exe", ["/c", "echo first & echo second"], { encoding: "utf8" });
// "first" and "second"
```

The POSIX habit that fails:

```sh
sh -c 'echo first
echo second'          # both run
```

## Cause

`cmd.exe /c` takes ONE command, not a script. A newline in the middle of that
string TERMINATES the command rather than separating two of them, and everything
after it is dropped — not run, and not passed along as arguments either. The
first command's output is all you get, which is why the loss is so easy to miss:
the visible result is exactly what a successful single command looks like.

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


---

---
id: cmd-shim-reparses-argv
title: "argv to a .cmd shim is re-parsed by cmd.exe — untrusted text becomes commands"
category: args-quoting
versions: "both"
failure: silent
context: [agent, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/e8c9c53ca118cd6ef7eb43a8a672a9588581aa2d
  - https://github.com/lidge-jun/cli-jaw/commit/f363a71c043c5dc986081968e3f138a1c94203d0
ontology:
  affects: [runtime-node, shell-cmd, env-windows]
  invokes: [command-cmd]
  caused_by: [mechanism-cmd-reparse]
  mitigated_by: [workaround-stdin-payload, workaround-strip-cmd-separators]
---

# argv to a .cmd shim is re-parsed by cmd.exe — untrusted text becomes commands

## Symptom

A tool passes user text (a prompt, a title, a model name) as an argument to a
CLI installed as a .cmd shim on Windows. Text containing an ampersand, a pipe,
or even a bare newline executes EXTRA COMMANDS at the tool's privileges.

## Repro

```js
// codex is codex.cmd on Windows; the .cmd launch goes through cmd.exe,
// which re-parses the whole line:
spawn("codex.cmd", ["exec", userText]);
// userText = "hello & calc.exe"  → calc runs.
// Newlines work too: cmd treats CR/LF as command boundaries.
```

## Cause

Launching a .cmd/.bat file ALWAYS involves cmd.exe, and cmd re-parses the
assembled command line — argv boundaries do not survive. Any untrusted byte
sequence containing cmd metacharacters (& | < > ^ % and CR/LF) escapes the
argument and becomes command syntax. This is the same mechanism Node hardened
with CVE-2024-27980 (EINVAL on naive .cmd spawn), but wrappers that route via
ComSpec re-open it.

## Workaround

- Put untrusted payloads on STDIN, never argv (the referenced fix moves the
  prompt to stdin "-").
- Before any ComSpec fallback, reject or strip command-separator bytes
  including CR/LF (the second referenced commit adds newlines to the separator
  set).


---

---
id: cmd-start-ampersand-splits
title: "cmd /c start truncates your URL at the first &"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd, command-start]
  caused_by: [mechanism-cmd-reparse]
  mitigated_by: [workaround-caret-escape-cmd, workaround-runtime-opener]
---

# cmd /c start truncates your URL at the first &

## Symptom

Opening a URL with cmd /c start opens the browser at ...?a=1 — the rest of the
query string vanished, and sometimes 'b' is not recognized as a command flashes.

## Repro

```
cmd /c start "" https://example.com/?a=1&b=2
# browser opens ...?a=1 ; cmd tries to run "b=2" as a second command
```

## Cause

cmd.exe re-parses the command line it is handed; & is its command separator.
URLs routinely contain &, so routing them through cmd /c start splits the line
into two commands at the first ampersand.

## Workaround

- Escape cmd metacharacters (& ^ | < > %) with ^ before interpolating — the
  referenced fix does this for browser-open.
- Better: avoid cmd — spawn rundll32 url.dll,FileProtocolHandler <url> or use
  the runtime's opener API.


---

---
id: createprocess-cmdline-32767
title: "os error 206 says the filename is too long when the filename is fine — the command line hit the 32,767-character cap"
category: args-quoting
versions: "both"
failure: misleading-error
context: [agent, script, ci]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/44
  - https://github.com/openai/codex/issues/38985
  - https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw
ontology:
  affects: [env-windows, env-win32-api, runtime-node]
  manifests_as: [error-enametoolong]
  caused_by: [mechanism-command-line-cap]
  mitigated_by: [workaround-payload-off-argv]
---

# os error 206 says the filename is too long when the filename is fine — the command line hit the 32,767-character cap

## Symptom

A spawn fails with an error about filenames, naming a path that is nowhere near
too long:

```
failed to launch helper: helper=C:\Program Files\app\helper.exe
error=The filename or extension is too long. (os error 206)
```

You check the path. It is 40 characters. You check MAX_PATH, enable long paths,
set the registry key, and nothing changes — because the path was never the
problem.

What makes it hard is the correlation: the failure appears on ONE machine and
scales with something unrelated to your code. In the reported case it grew with
the number of loose files in the user's profile directory, because the payload
being passed enumerated them.

## Repro

```js
const { spawnSync } = require("node:child_process");
const payload = "x".repeat(40000);
const r = spawnSync("cmd.exe", ["/c", "echo", payload]);
r.error.code;      // ENAMETOOLONG  (Win32 206)
```

POSIX has a limit too — `E2BIG`, typically around 2MB on Linux — so the same code
survives an argument size that Windows refuses.

## Cause

`CreateProcess` caps its `lpCommandLine` parameter at 32,767 characters, and the
cap applies to the WHOLE assembled line: executable path, every argument, every
quote and separator the runtime inserted.

Windows reports that overflow as `ERROR_FILENAME_EXCED_RANGE` (206) — the same
code it uses for a path exceeding MAX_PATH. Node maps 206 to `ENAMETOOLONG`, so
two unrelated limits arrive under one name, and the name describes the one you are
not hitting.

That collision is the entire difficulty. Every search result for 206 and
`ENAMETOOLONG` is about MAX_PATH and long-path opt-in, none of which touches the
command-line cap. There is no registry switch and no manifest for this one; 32,767
is the ceiling.

The practical trigger is passing data as an argument: a JSON payload, a file list,
a serialized config. Those grow with the user's environment rather than with your
input, so they cross the line on someone else's machine.

## Workaround

Get the payload out of argv:

```js
// stdin — no size limit worth worrying about
const child = spawn(helper, ["--stdin"], { stdio: ["pipe", "inherit", "inherit"] });
child.stdin.end(JSON.stringify(payload));

// or a temp file, passing only the path
writeFileSync(tmp, JSON.stringify(payload));
spawnSync(helper, ["--payload-file", tmp]);
```

Both are better than argv even below the limit, because argv is visible in process
listings to every user on the machine — a payload with a token in it should never
have been an argument.

If you must keep it in argv, measure before spawning and fail with a message that
names the real limit. `payload_len=35044` in your own log is worth more than
os error 206 in the runtime's.

---

`max-path-260` owns the other meaning of error 206. The two cases exist
separately precisely because Windows reuses the code: one is a 260-character path
ceiling with a documented opt-in, the other is a 32,767-character command-line cap
with none.


---

---
id: dollar-backslash-vars
title: "\ and \ are real variable names, so sed backreferences and price ranges are deleted en route to the child"
category: args-quoting
versions: "both"
failure: silent
context: [agent, script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/10
ontology:
  affects: [runtime-node, shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-node]
  caused_by: [mechanism-string-interpolation]
  mitigated_by: [workaround-single-quote-regex]
---

# \ and \ are real variable names, so sed backreferences and price ranges are deleted en route to the child

## Symptom

You pass a `sed`, `awk`, `jq` or price string to an external program in double
quotes. No error. The program just behaves as if you asked for something else,
because parts of your argument were **deleted before it was launched**.

```powershell
node argv.mjs "s/(a)(b)/$2$1/"      # 0: "s/(a)(b)//"     backreferences gone
node argv.mjs "{print $1}"          # 0: "{print }"       awk field gone
node argv.mjs "$100-$200"           # 0: "-"              whole price range gone
```

That last one is the nastiest: a two-value range collapsed into a single hyphen,
and nothing anywhere reported a problem.

## Repro

```js
// argv.mjs — prints what the child actually received
const args = process.argv.slice(2);
console.log("argc=" + args.length);
args.forEach((a, i) => console.log(i + ": " + JSON.stringify(a)));
```

```powershell
node argv.mjs "cost is $100 $env:USERNAME"
# 0: "cost is  super"        <- $100 deleted, $env:USERNAME expanded

node argv.mjs 'cost is $100 $env:USERNAME'
# 0: "cost is $100 $env:USERNAME"   <- single quotes are intact
```

## Cause

`$100` is a **legal PowerShell variable name**. Digits are valid identifier
characters, so `$1`, `$2` and `$100` are variables that simply happen to be
unset, and an unset variable interpolates to the empty string. Verify it
directly:

```powershell
$100 = "SET"; node argv.mjs "price $100"
# 0: "price SET"        <- it really is a variable
```

This is why the failure is silent rather than loud. It is not a parse error; it
is a successful expansion of a variable you never meant to write.

`Set-StrictMode -Version Latest` *does* catch it:

```
The variable '$nosuchvar' cannot be retrieved because it has not been set.
```

but StrictMode is off by default, and almost nobody enables it in the shell they
use to run one-off commands — which is exactly where these arguments get typed.

## What survives and what does not

| argument | result |
|---|---|
| `"$100-$200"` | `"-"` |
| `"{print $1}"` | `"{print }"` |
| `"s/(a)(b)/$2$1/"` | `"s/(a)(b)//"` |
| `".items[] \| .name"` | intact — no `$` |
| `"*.ts"`, `"file[1].txt"` | intact — no glob expansion |
| `"a;b"`, `"c,d"` | intact |
| `"\\\\server\\share\\f.txt"` | intact |
| `'...'` single-quoted | always intact |

Globs, semicolons, commas and UNC paths are all safe. `$` is the entire problem.

## Workaround

```powershell
node argv.mjs 's/(a)(b)/$2$1/'          # single quotes: nothing expands
node argv.mjs "cost is \`$100"           # backtick escape inside double quotes
```

Rule of thumb: any argument destined for another program's *own* syntax — regex,
awk, jq, shell snippets, format strings, money — belongs in single quotes.
Backslash does not escape `$` in PowerShell; the backtick does.

---

`dq-regex-interpolates` covers `$var` interpolation in regexes used **inside**
PowerShell (`-match`, StrictMode errors). This case is the external-process
variant: the argument is deleted on its way to another program, so PowerShell
reports nothing and the receiving tool sees a valid-but-different request. It
also records that `$1`, `$2` and `$100` are real variable names — which is why
`sed` backreferences, `awk` fields and dollar amounts are the three shapes that
get hit in practice.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.


---

---
id: dq-regex-interpolates
title: "Double-quoted regex interpolates $vars — and backslash won't save you"
category: args-quoting
versions: "both"
failure: misleading-error
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/3d198e2b80ddb13d02ce63b65e5c88a25b428009
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-match, command-set-strictmode]
  manifests_as: [error-unset-variable]
  caused_by: [mechanism-string-interpolation]
  mitigated_by: [workaround-single-quote-regex]
  unsafe_fix: [workaround-escape-more-quotes]
---

# Double-quoted regex interpolates \$vars — and backslash won't save you

## Symptom

A test asserts against a regex like `"SetEnvironmentVariable\(\$entries..."` in a
double-quoted string. Under `Set-StrictMode` it explodes with "variable
'\$entries' cannot be retrieved" — or worse, without StrictMode it silently
matches garbage because \$entries expanded to nothing.

## Repro

```powershell
Set-StrictMode -Version Latest
$text -match "pattern(\$entries -join)"
# ERROR: The variable '$entries' cannot be retrieved because it has not been set.
# The backslash did NOT escape the dollar — \ is not an escape char in PowerShell.
```

## Cause

Two habits from other languages collide: PowerShell interpolates `$var` inside
DOUBLE-quoted strings, and its escape character is the backtick — backslash has
no escaping power. A regex written for .NET/PCRE with `\$` still interpolates.
The variable expands at string-construction time, before the regex engine sees
anything.

## Workaround

- Write regexes that mention `$` in SINGLE quotes: `'pattern(\$entries)'` —
  no interpolation, backslash reaches the regex engine intact.
- If double quotes are unavoidable, escape with backtick: `"\`$entries"`.


---

---
id: english-and-not-separator
title: "The English word 'and' is not a statement separator"
category: args-quoting
versions: "both"
failure: misleading-error
context: [interactive, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/a00f1a4618c683e173af1e17ee06e4a25e0434a1
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-remove-item]
  manifests_as: [error-parameterbinding]
  caused_by: [mechanism-prose-as-argument]
  mitigated_by: [workaround-semicolon-separator]
---

# The English word 'and' is not a statement separator

## Symptom

A user (or an agent-generated recovery message) pastes a line like
"remove the variable and set the new one" written as actual commands joined by
the word `and` — and PowerShell throws a baffling parameter-binding error on
the FIRST command, or silently binds `and` as an argument.

## Repro

```powershell
Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue and $env:CODEX_HOME = "C:\new"
# 'and' plus everything after it binds into Remove-Item's argument list —
# one broken statement, not two commands.
```

## Cause

PowerShell has `-and` as a boolean operator inside expressions, but bare `and`
between commands is just another positional argument. Prose-style command
chaining parses as one statement. Documentation and agent prompts that render
"do X and do Y" as a single line produce copy-paste traps.

## Workaround

- Separate statements with `;` (unconditional) or check `$?`/use `if` for
  conditional chaining (5.1 has no `&&`).
- The referenced fix changed a shipped recovery one-liner from "... and ..." to
  "...; ..." exactly because users pasted it verbatim.


---


# git hands merge.<name>.driver to sh, which eats the backslashes, and the driver that never ran looks like a conflict

## Symptom

You register a custom merge driver so that a structured file merges by rule instead
of by line:

```
git config merge.mine.driver "/path/to/mydriver %O %A %B %P"
```

and `.gitattributes` binds it with `*.md merge=mine`. On Windows the merge comes
back as an ordinary conflict:

```
Auto-merging f.md
CONFLICT (content): Merge conflict in f.md
Automatic merge failed; fix conflicts and then commit the result.
```

Exit 1, conflict markers in the file, nothing that says a driver was involved. The
reasonable reading is that the driver ran and could not resolve it. The driver never
ran at all. Above the CONFLICT line — easy to miss, and gone once a tool captures
only the last lines — is a shell error about a command that does not exist.

## Repro

Full script: `devlog/260911_windows-round/repro-merge-driver.ps1`. Three registrations
of the *same working driver*, same repository, same conflict.

**A — a Windows path with backslashes:**

```
driver : C:\Users\me\AppData\Local\Temp\fp-mergedriver\mydriver %O %A %B %P
git    : C:\Users\...\mydriver .merge_file_DULjNk .merge_file_yAo41X .merge_file_ygd7B7 'f.md':
         line 1: C:UssuperAppDataLocalTempfp-mergedrivermydriver: command not found
git    : CONFLICT (content): Merge conflict in f.md
exit   : 1
f.md   : mine
```

Every backslash is gone from the path in the error message. `C:\Users\me\...` was
consumed as escape sequences.

**B — same driver, forward slashes, still extensionless with a shebang:**

```
driver : C:/Users/me/AppData/Local/Temp/fp-mergedriver/mydriver %O %A %B %P
git    : Python was not found; run without arguments to install from the Microsoft Store, ...
git    : CONFLICT (content): Merge conflict in f.md
exit   : 1
f.md   : mine
```

The path now resolves and the shebang is honoured — straight into the Microsoft
Store `python3` execution alias.

**C — explicit interpreter, forward slashes, both quoted:**

```
driver : "C:/Users/me/.../python3.cmd" "C:/Users/me/.../mydriver" %O %A %B %P
git    : Auto-merging f.md
git    : Merge made by the 'ort' strategy.
exit   : 0
f.md   : MERGED-BY-DRIVER
```

All three failures present identically to a caller that checks the exit code: exit
1, conflict markers, no driver output.

## Cause

Git does not `CreateProcess` the driver command. It runs it through a shell, and on
Windows that is Git's bundled `sh`. So the value of `merge.<name>.driver` is a
**shell command line**, not an argv vector, and it gets shell tokenisation applied
to it: backslash is an escape character, and `C:\Users\me` becomes `C:Usersme`.
The placeholders `%O %A %B %P` are substituted by git before the shell sees them,
which is why they must stay unquoted while everything around them must be quoted.

The second layer is that an extensionless file is only executable through its
shebang, and `#!/usr/bin/env python3` on Windows resolves `python3` through PATH,
where the Store execution alias usually sits first. Git's own `chmod +x` is
meaningless here too: with `core.filemode=false` on NTFS there is no executable bit
to set.

What makes it a landmine rather than a bug is git's fallback. A merge driver that
exits non-zero is *defined* to mean "conflict", so a driver that could not be
launched is indistinguishable from a driver that ran and disagreed. Git reports the
documented outcome for a failure it did not cause.

## Workaround

Name the interpreter, use forward slashes, quote both paths, leave the placeholders bare:

```bash
PY=$(command -v python3 || command -v python)
case "$PY" in *WindowsApps*) echo "Store stub; install real CPython" >&2; exit 1 ;; esac
DRIVER=$(cygpath -m "$PWD/bin/mydriver")     # -m gives C:/... with forward slashes
git config merge.mine.driver "\"$PY\" \"$DRIVER\" %O %A %B %P"
```

Quoting is not optional the moment a path contains a space — `Program Files` or any
user whose name has one — and `cygpath -m` is the piece that avoids the backslash
problem at the source rather than escaping around it.

Verify by asserting on the *result*, never on git's exit code:

```
git merge other
test "$(cat f.md)" = "MERGED-BY-DRIVER"
```

Do not debug this by reading the tail of git's output. The only line that explains
it is printed before `Auto-merging`, and it is the first thing a log tail drops.

---

`dollar-backslash-vars` and `backslash-quote-ends-span` are the same backslash-as-escape
mechanism in other quoting contexts; this is the git-config surface of it, where the
consequence is a wrong merge rather than a failed command. `windowsapps-alias-eperm`
is variant B's root cause — there it surfaces as EPERM at spawn, here as a friendly
sentence on stdout that a merge driver treats as its output.


---

---
id: join-semicolon-splits-startprocess
title: "Joining command fragments with '; ' splits Start-Process mid-call"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/ac8c0d2dfdae12904d6ed818763bc069cdb84764
  - https://github.com/lidge-jun/opencodex/commit/ebf947ec579a4750b261e3247aabd7a5675b3764
ontology:
  affects: [runtime-node, shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-start-process]
  caused_by: [mechanism-statement-terminator]
  mitigated_by: [workaround-space-join-params]
---

# Joining command fragments with '; ' splits Start-Process mid-call

## Symptom

An elevation launcher builds one `Start-Process` invocation from string
fragments and joins them with `"; "`. The elevated process starts — but without
its arguments and without the UAC verb, so the elevated action silently does the
wrong thing (or nothing).

## Repro

```js
// Generator code building a PowerShell command line:
const cmd = ["Start-Process -FilePath 'app.exe'", "-ArgumentList 'install'", "-Verb RunAs"].join("; ");
// Produces: Start-Process -FilePath 'app.exe'; -ArgumentList 'install'; -Verb RunAs
// → Start-Process runs with NO args; the rest are separate (broken) statements.
```

## Cause

`;` is PowerShell's statement terminator. A generator that joins PARAMETER
fragments of one call with `"; "` inserts statement boundaries mid-command.
Each fragment after the first is parsed as a new statement starting with a
parameter token — a parse error at best, a silently degraded `Start-Process`
at worst.

## Workaround

- Join parameter tokens of a single call with spaces (or build an array and
  splat); place `;` only BETWEEN complete statements.
- The fix joined fragments with "" and kept `;` only after the complete
  `Start-Process ... -Wait`.


---

---
id: oss-native-arg-quoting
title: Embedded quotes and empty args vanish before native commands see them
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: third-party
repro: verified
refs:
  - https://github.com/PowerShell/PowerShell/pull/14692
  - https://github.com/lidge-jun/cli-jaw/commit/77153112420acaadd961defc6a2b9a170ee70d43
  - https://github.com/PowerShell/PowerShell/pull/15408
ontology:
  affects: [runtime-node, shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-node]
  caused_by: [mechanism-native-argv-rebuild]
  mitigated_by: [workaround-ps-native-argument-passing, workaround-file-payload]
---

# Embedded quotes and empty args vanish before native commands see them

## Symptom

A native command receives mangled arguments: embedded double quotes are stripped,
empty-string arguments disappear entirely, JSON payloads arrive corrupted. The
PowerShell side looks correct; only the receiving program sees the damage.

## Repro

```powershell
node -e "console.log(JSON.stringify(process.argv.slice(1)))" '{"key": "value"}' ""
# Legacy argument passing: quotes stripped, empty arg dropped:
# ["{key: value}"]
```

## Cause

PowerShell historically rebuilt a command line string for native processes instead
of passing an argument vector, re-quoting by heuristic. PR #14692 introduced
`$PSNativeCommandArgumentPassing = 'Standard'` (7.2+) using .NET ArgumentList to
fix quotes/empty/space handling — and PR #15408 immediately had to carve out a
Windows legacy mode because some Windows CLIs (msiexec-style `KEY="value"`)
depended on the broken behavior. The trap is version- and platform-dependent.

## Workaround

- Pin behavior explicitly on 7.2+: `$PSNativeCommandArgumentPassing = 'Standard'`
  (or `'Legacy'` when a Windows CLI needs it).
- Pass complex payloads via files or stdin, never inline JSON arguments, when 5.1
  must be supported.
- Test argument round-trips on every runtime you claim to support.


---

---
id: piped-iex-drops-params
title: "irm | iex cannot pass parameters — your -Switch goes to iex, not the script"
category: args-quoting
versions: "both"
failure: silent
context: [interactive, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0851921ae0b3ab382c2546b24e5aa67b0d163b37
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-iex, command-irm]
  manifests_as: [error-parameterbinding]
  caused_by: [mechanism-iex-session]
  mitigated_by: [workaround-download-then-file]
---

# irm | iex cannot pass parameters — your -Switch goes to iex, not the script

## Symptom

Docs advertise `irm https://x/install.ps1 | iex -SomeOption` and users report
the option does nothing — or `iex` errors about an unknown parameter. The
streamed installer always runs with defaults.

## Repro

```powershell
irm https://example.com/install.ps1 | iex -BootstrapDependencies
# Invoke-Expression : A parameter cannot be found that matches parameter name
# 'BootstrapDependencies'. (iex has no such parameter — and no way to forward one)
```

## Cause

`Invoke-Expression` evaluates a STRING. It has no mechanism to bind parameters
into the script it evaluates; anything after `iex` is an argument to iex
itself. The pipe-to-iex distribution form structurally cannot accept options.

## Workaround

- Parameterized installs must download then invoke:
  `irm url -OutFile i.ps1; powershell -File i.ps1 -SomeOption` (mind
  execution-policy-file-block).
- Or read options from env vars inside the script (`$env:INSTALL_OPTS`), which
  survive the iex form. The referenced commit removed the misleading flagged
  one-liner and pinned a contract test that iex takes no installer parameters.


---

---
id: prose-as-unknown-flags
title: "when a CLI reports your prose as unknown flags, PowerShell shredded the argument - not the CLI"
category: args-quoting
versions: "both"
failure: misleading-error
context: [agent, ci, interactive]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/4
ontology:
  affects: [runtime-node, shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-gh, command-node]
  manifests_as: [error-unknown-arguments]
  caused_by: [mechanism-native-argv-rebuild, mechanism-string-interpolation]
  mitigated_by: [workaround-file-payload, workaround-ps-native-argument-passing]
---

# when a CLI reports your prose as unknown flags, PowerShell shredded the argument - not the CLI

## Symptom

You pass a multi-line document to a CLI as one argument. The receiving tool
reports a *usage error* naming fragments of your prose as if they were flags:

```
gh: unknown arguments ["is" "not" "installed and `EINVAL` reads as bad" "arguments..."]
```

It reads like the CLI mis-parsed its own flags. It didn't. Your single argument
was shredded into many before the CLI was even started, and the pieces that
survive are the ones between your quote characters.

## Repro

```powershell
$body = Get-Content notes.md -Raw    # contains: he said "hello there" to me
gh issue create --title t --body $body
# -> unknown arguments ["hello" "there"]
```

Same shape with `node -e`, where escapes are eaten before Node sees them:

```powershell
node -e "const s='a';console.log(s.split(/\r?\n/).length)"
# SyntaxError: Invalid regular expression: missing /
# — the \r\n became a REAL newline inside the -e string
```

## Cause

PowerShell rebuilds a command line for native processes and re-quotes by
heuristic. Embedded double quotes are consumed as delimiters rather than passed
through, so one argument becomes N. Escape sequences inside a double-quoted
PowerShell string are expanded by PowerShell first, so what the child receives is
not what you typed.

The tell is that the error names *your content* as arguments. Any time a CLI
complains about words from your prose, stop debugging the CLI.

## Workaround

- Never inline prose or code as an argument. Use the file-based flag every good
  CLI provides: `gh issue create --body-file notes.md`, `git commit -F msg.txt`.
- For `node -e`, put the script in a `.mjs` file and run it. Escape sequences in
  a here-string or a file are safe; escape sequences in `-e "..."` are not.
- On 7.2+, `$PSNativeCommandArgumentPassing = 'Standard'` fixes the argument
  vector, but it does nothing for the `-e` case, which is PowerShell's own string
  parsing.

---

`oss-native-arg-quoting` documents the mechanism (quotes stripped, empty args
dropped). This entry is the *diagnostic*: what the failure looks like from the
outside, and why the error message points at the wrong program. That framing is
what an agent needs, because the visible symptom is a CLI usage error rather than
anything resembling a quoting problem.

## Real-world hit

Filing the first issue in this repository failed exactly this way — `gh issue
create --body "$text"` shredded the markdown into flags. Switching to
`--body-file` fixed it.


---

---
id: ps-file-extension-dispatch
title: "powershell -File refuses scripts that aren't named .ps1"
category: args-quoting
versions: "both"
failure: hard-error
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0efd755ed938e13bb527105fd83500ad1001d0e6
  - https://github.com/lidge-jun/opencodex/commit/b63f5c80fa4bff17e8dc7ad7c8ed666faaf3d29e
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-powershell]
  manifests_as: [error-not-a-powershell-script]
  caused_by: [mechanism-extension-dispatch]
  mitigated_by: [workaround-shell-matching-suffix]
---

# powershell -File refuses scripts that aren't named .ps1

## Symptom

A bootstrap downloads an installer script to a temp file and runs it with
`powershell -File $tmpfile`. On Windows it fails with "the file ... is not
recognized as a PowerShell script" — because the temp file was created with a
`.sh` (or extensionless) name by cross-platform code.

## Repro

```powershell
Copy-Item installer.ps1 installer.sh
powershell -File .\installer.sh
# Processing -File 'installer.sh' failed: the file does not have a '.ps1' extension.
```

## Cause

`powershell -File` / `pwsh -File` dispatch on the FILENAME EXTENSION, not the
content. Anything not ending in .ps1 is rejected before parsing. Cross-platform
download helpers that default temp suffixes to .sh silently arm this on the
Windows branch.

## Workaround

- Choose the temp suffix by target shell: `.ps1` when the launcher is
  PowerShell, `.sh` for POSIX. The referenced fix does exactly this
  (suffix = shell === 'powershell' ? 'ps1' : 'sh').


---

---
id: shell-true-fallback-injects
title: "the shell:true fallback you added to fix a spawn error turns any user text in argv into a second command"
category: args-quoting
versions: "both"
failure: silent
context: [agent, script, ci]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/21
  - https://github.com/lidge-jun/cli-jaw/commit/8f294b449a99acee7c0e0f7057898008fef9f441
ontology:
  affects: [shell-cmd, env-windows, runtime-node]
  invokes: [command-cmd]
  caused_by: [mechanism-cmd-reparse]
  mitigated_by: [workaround-refuse-shell-on-untrusted-argv]
  unsafe_fix: [workaround-shell-true]
---

# the shell:true fallback you added to fix a spawn error turns any user text in argv into a second command

## Symptom

There is no symptom. That is the case.

Your Windows spawn failed with `ENOENT` or `EINVAL`, you added `shell: true`, it
worked, and you moved on. Everything keeps working. Nothing in a log or a test
says that one argument in that argv is now interpreted rather than passed.

The failure appears the first time a value in argv contains `&`, which for an
agent, a chat CLI, or anything that forwards a user prompt is a matter of time
rather than luck.

## Repro

```js
const { spawnSync } = require("node:child_process");
const userText = "summarize this & calc";

// shell-less: one argument, exactly as written
spawnSync("mytool.exe", ["--prompt", userText], { stdio: "inherit" });

// with the shell: cmd.exe sees
//   mytool.exe --prompt summarize this & calc
// and runs calc.exe as a second command
spawnSync("mytool.exe", ["--prompt", userText], { shell: true, stdio: "inherit" });
```

With a `.cmd` target the contrast is starker still, because there is no working
shell-less version to compare against: shell-less it is `EINVAL`, and with the
shell it is injectable. The fix for the first problem is the second problem.

Node joins argv with spaces, escapes nothing, and hands the result to
`cmd.exe /d /s /c "<joined>"`. Inside that line `&`, `|`, `<`, `>`, `^`, `%VAR%`,
and a raw newline are all syntax.

## Cause

`shell: true` does not "run the same thing through a shell". It flattens argv into
a single command line and hands that string to `%ComSpec%`, which parses it again
with its own grammar. Node does not escape cmd metacharacters when it does this,
and cannot: it has no way to know which characters you meant as data.

The reason this is such a common wound on Windows specifically is that the two
errors pushing you toward it are both Windows-only. Bare `npm` is `ENOENT` because
PATHEXT resolution is a shell behavior; `npm.cmd` is `EINVAL` because Node refuses
to spawn `.cmd` shell-less after the CVE-2024-27980 hardening. `shell: true` fixes
both, which is exactly why it is the answer everyone reaches.

Note the two conditions have to coincide — an unresolvable command AND untrusted
text in argv — so the vulnerability hides behind a path most of your calls never
take.

## Workaround

Resolve the target yourself and spawn shell-less, then treat the fallback as a
decision rather than a default:

```js
// 1. PATH x PATHEXT walk -> absolute path
// 2. .exe        -> spawn directly, no shell
//    .cmd/.bat   -> cmd.exe /d /s /c with windowsVerbatimArguments and caret escaping
// 3. unresolvable AND argv carries untrusted text -> REFUSE, do not fall back
```

Gate the refusal on argv CONTENT, not on a per-tool allowlist. An allowlist says
"this caller is safe", which stops being true the day someone adds a positional
prompt to it; inspecting the values cannot go stale that way.

Refuse on the characters that can actually start a second command:
`& | < > ^ % !`, plus CR and LF, which cmd.exe treats as command boundaries.

Parentheses are the one deliberate omission: cmd.exe treats them as grouping
syntax, but they appear in ordinary paths — `C:\Program Files (x86)` — so
refusing on them breaks normal installs on a compatibility path whose purpose is
to keep unusual installs working. Double quotes are NOT in that category. They do
not appear in ordinary paths, and they terminate the wrapper quoting Node puts
around the joined line, so keep them in the refusal set.

Best of all, pass user text on stdin. A value that never enters argv cannot be
re-parsed by anything.

---

`oss-native-arg-quoting` is the PowerShell-side wound: argv rebuilt on the way to
a native command. `cmd-shim-reparses-argv` is the same cmd.exe re-parse reached by
spawning a shim on purpose, and `spawn-npm-enoent-einval` is where the two errors
that push you here come from — it names `shell: true` as its unsafe fix, and this
case is what that fix costs.

The distinct reader here is the one who already applied the fix: it worked, the
error went away, and nothing since has told them that one argument in that call
is now interpreted rather than passed.


---

---
id: windowstyle-hidden-vs-windowshide
title: "-WindowStyle Hidden still flashes a console window"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/93a083d1fc0a28853dc3eb385bf55e16af9e5b7f
  - https://github.com/lidge-jun/opencodex/commit/26dc5aa2b78bf902b8b27a122d6ada1bd2184906
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows, env-win32-api]
  invokes: [command-powershell]
  caused_by: [mechanism-console-allocation]
  mitigated_by: [workaround-create-no-window]
  unsafe_fix: [workaround-windowstyle-hidden]
---

# -WindowStyle Hidden still flashes a console window

## Symptom

A background service launches `powershell.exe -WindowStyle Hidden -Command ...`
for a quick lookup, and users see a console window flash on screen anyway —
sometimes stealing focus mid-typing. The flag looks correct; the window appears
regardless.

## Repro

```powershell
# From a console-less parent (a GUI app or service):
powershell.exe -WindowStyle Hidden -Command "whoami"
# A new console window is allocated and briefly visible.
```

## Cause

`powershell.exe` is a console-subsystem binary. When its parent has no console,
Windows allocates a brand-new console at process creation — BEFORE PowerShell
ever parses `-WindowStyle Hidden`. The flag hides the window only after startup,
which is why it flashes. Suppression must happen at the Win32 level:
CREATE_NO_WINDOW (`windowsHide: true` in Node/Bun spawn options).

## Workaround

- Set `windowsHide: true` (CREATE_NO_WINDOW) in the spawning runtime; treat
  `-WindowStyle Hidden` as a cosmetic hint, not a suppression mechanism.
- The referenced production fix moved identity/CIM lookups to `windowsHide`
  after user-visible console flashes (#1236).
