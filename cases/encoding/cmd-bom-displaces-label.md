---
id: cmd-bom-displaces-label
title: "a BOM is not whitespace, so it turns a batch label into a command and the next token is read as redirection"
category: encoding
versions: "both"
failure: hard-error
context: [agent, script, ci]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/30cdcb6dc235a7f250f590f2fb6986bb0b2977b9
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd, command-out-file]
  manifests_as: [error-unexpected-at-this-time]
  caused_by: [mechanism-bom-sniffing, mechanism-nonspace-prefix-kills-label]
  mitigated_by: [workaround-set-content-utf8nobom, workaround-strip-bom-at-every-read]
  related_to: [case:bomless-bat-oem-codepage]
---

# a BOM is not whitespace, so it turns a batch label into a command and the next token is read as redirection

## Symptom

A `.cmd` file that is deliberately both valid batch and valid bash — the
`: << 'BLOCK'` polyglot that lets one file be dispatched either way — stops working
after somebody edits it. cmd.exe reports:

```
<< was unexpected at this time.
```

On a Korean install the same thing arrives as `<<은(는) 예상되지 않았습니다`, which is
worth knowing because it is what actually gets pasted into a search box.

The file looks identical in every editor. `git diff` shows nothing, or shows a
whole-file change with no visible difference.

## Repro

Four copies of the same first line, `: << 'CMDBLOCK'`, followed by
`@echo off` / `echo MARKER_OK` / `exit /b 0` / `CMDBLOCK`:

| file | result |
|---|---|
| no BOM | `MARKER_OK`, exit 0 |
| UTF-8 BOM (`EF BB BF`) | exit 255, `<<` unexpected |
| one leading space | `MARKER_OK`, exit 0 |
| one leading tab | `MARKER_OK`, exit 0 |

The whitespace rows are the point. They are what proves the rule is about the BOM
specifically, and not about indentation — which is the wrong lesson to take away,
and the one most write-ups take.

A second measured variant shows the same mechanism without the polyglot: put a BOM
in front of an ordinary `:tgt` label and the script keeps running, but reports
`'<BOM>tgt' is not recognized as an internal or external command`. The label became
a command. A `goto tgt` aimed at it can no longer find it.

Measured on Windows 11.

## Cause

Two rules meet.

A batch label is recognised when its colon is the first **non-whitespace**
character on the line. Leading spaces and tabs are tolerated, which is why the
whitespace rows above are green. A BOM is not whitespace — it is three ordinary
bytes as far as cmd.exe is concerned, and cmd.exe does not strip it — so the line
stops being a label and becomes a command to parse.

What is left to parse is `<< 'CMDBLOCK'`. `<<` is bash's here-doc opener and has
no meaning in batch, so cmd.exe reads it as a doubled input redirection with
nothing to redirect, and gives up.

The error names the redirection. It never names the three invisible bytes that
caused it, which is why this reads as a corrupt script rather than an encoding
problem, and why the first instinct is to rewrite the working line.

## Workaround

Do not emit a BOM:

```powershell
Set-Content -Encoding utf8NoBOM -Path run-hook.cmd -Value $text   # 7.x
[IO.File]::WriteAllText($path, $text, [Text.UTF8Encoding]::new($false))  # 5.1
```

`utf8NoBOM` does not exist on Windows PowerShell 5.1, and `Out-File -Encoding utf8`
there writes a BOM — that is the trap this inherits from `utf8-bom-still-breaks-grep`.

Better, make it structural rather than a rule people have to remember: strip a BOM
on every read and emit none on every write. A file that picks one up from an editor
is then repaired the next time anything touches it, instead of waiting to be
diagnosed. If you also ship a `.gitattributes`, note that a polyglot `.cmd` needs
its own entry — see `autocrlf-shebang-cr` for the line-ending half of the same problem.

## The other half of this trap

`bomless-bat-oem-codepage` is the same three bytes with a different consequence:
there the BOM fuses onto `@ECHO OFF` and the error is a mangled command name and
exit 9009. Same cause, different grammar, completely different search terms. If you
arrived here from `<<`, read that one too — and vice versa.

