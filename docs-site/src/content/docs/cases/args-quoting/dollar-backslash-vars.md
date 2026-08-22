---
title: "\ and \ are real variable names, so sed backreferences and price ranges are deleted en route to the child"
description: "args-quoting landmine — silent (both)"
sidebar:
  label: "dollar backslash vars"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#string-interpolation">string-interpolation</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">string interpolation</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">single quote regex</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/10>
