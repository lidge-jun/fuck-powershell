---
title: "escaping a quote ENDS the quoted span, so one JSON argument silently becomes several"
description: "args-quoting landmine — misleading-error (5.1)"
sidebar:
  label: "Backslash ends quoted span"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#native-argv-rebuild">native-argv-rebuild</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">INVALID JSON</span></div><div class="row"><span class="k">Mechanism</span><span class="v">native argv rebuild</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">file payload</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/6>
