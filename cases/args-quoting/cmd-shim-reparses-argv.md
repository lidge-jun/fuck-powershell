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
