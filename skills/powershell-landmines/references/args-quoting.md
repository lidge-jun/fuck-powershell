
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
