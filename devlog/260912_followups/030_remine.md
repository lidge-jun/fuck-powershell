# wp3-remine

## The question

The win-hooks round accepted 10 of 34 documented entries and rejected 24 in three
groups: that repository's own engine history, host policy rather than Windows, and
already covered here. The user asked whether any of the 24 deserve a case under a
different framing — particularly the host-policy group.

## Method

1. Re-read `AGENTS.md` at the pinned SHA for each of the 24, from the local clone.
2. For each, answer one question: **is the mechanism Windows' own?** A defect in
   win-hooks' patcher is not. A host's trust policy is not. A Windows behaviour that a
   host merely exposes **is**.
3. For anything that survives step 2, dedupe against all 108 existing cases with
   `fp search` and `rg` before accepting it.
4. Anything accepted needs a reachable public commit or PR, `repro: verified` if it
   can be measured on this machine and `repro: historical` with a verification note if
   it cannot.

## The one worth a second look

CASE-33 — a host silently skipping a hook whose manifest hash changed — was rejected
as host policy, and that rejection is probably right. But the neighbouring observation
is not host policy: a Windows `.cmd` shim cannot be executed by `spawnSync` directly,
which is why enumeration has to go through `cmd.exe /d /s /c`. The round recorded that
as already covered by `spawn-npm-enoent-einval` and `cmd-shim-reparses-argv`. Verify
that claim rather than inheriting it.

Similarly CASE-24's `awk '{print $1}'` returning the interpreter instead of the script
was filed as engine history. The generalisable part — that a command line's first token
is the interpreter, not the target, whenever an interpreter prefix is present — may be
a real agent-facing landmine that the corpus does not state.

## Expected outcome

A table covering all 24 with a verdict and a reason. **Rejecting all 24 again is a
legitimate and likely result**, and is to be recorded with reasons rather than padded
into weak cases. The round's own standard applies: a case needs a mechanism Windows
owns, a reproduction, and a citation someone else can check.

## Accept criteria

- All 24 entries appear in the table with a verdict.
- Any accepted case passes lint, graph validation and the citation rule.
- Any rejection names which of the three groups it falls into and why that still holds.

---

## Result: 23 rejections upheld, 1 overturned

Two independent `xai/grok-4.6` analysts re-read all 24 against `AGENTS.md` and the
108-case corpus. Both returned **24/24 reject-confirmed**. A unanimous clean sweep is
exactly the result that deserves suspicion, so a third reviewer was dispatched with one
job: attack it. It overturned CASE-07, correctly.

| case | verdict | group | reason |
|---|---|---|---|
| CASE-02 | reject | already covered | CRLF in `read`; same line-split family as `split-n-leaves-cr` |
| CASE-05 | reject | engine history | `awk index()` partial JSON rewrite in the patcher |
| CASE-06 | reject | host policy | `installed_plugins.json` v2 schema |
| CASE-07 | **OVERTURNED** | — | see below |
| CASE-08 | reject | already covered | optional Unix binaries absent — `command-v-noop` |
| CASE-10 | reject | engine history | patcher re-appended args the descriptor already had |
| CASE-11 | reject | host policy | host omits `$CLAUDE_PLUGIN_ROOT` from slash-command bash |
| CASE-12 | reject | host policy | host plugin-cache layout |
| CASE-13 | reject | host policy | host reinstall overwrites `hooks.json` |
| CASE-14 | reject | engine history | a work principle, not a Windows behaviour |
| CASE-15 | reject | engine history | scanner vs verify coverage gap |
| CASE-16 | reject | engine history | `grep -o` stopped at an escaped quote |
| CASE-17 | reject | engine history | win-hooks' own fail-open suppression |
| CASE-19 | reject | engine history | `awk gsub` double-escape produced `C://` |
| CASE-21 | reject | engine history | win-hooks used to depend on Python for JSON |
| CASE-23 | reject | already covered | cmd vs Git Bash PATH; the interpreter/PATH cluster owns it |
| CASE-24 | reject | engine history | `awk '{print $1}'` took the interpreter token |
| CASE-25 | reject | host policy | timeout unit and silent kill are the host's; dropped once already |
| CASE-26 | reject | host policy | SessionStart-once is host lifecycle |
| CASE-28 | reject | already covered | `spawn-npm-enoent-einval` + `cmd-shim-reparses-argv` |
| CASE-30 | reject | engine history | CLI/skill surface merge |
| CASE-32 | reject | engine history | observability of win-hooks' own hook |
| CASE-33 | reject | host policy | Codex `trusted_hash` skip — win-hooks itself rules this is not a Windows defect |
| CASE-34 | reject | engine history | leftover pre-descriptor wrappers |

## Why CASE-07 was overturned

The first two analysts dismissed it as already covered by
`caller-picks-interpreter-not-shebang` and `pathext-bare-name-enoent`. The challenger
showed both claims are false, and it is right:

- `pathext-bare-name-enoent` is about a name with **no** extension. PATHEXT is not
  consulted at all when the name already ends in `.sh`.
- `caller-picks-interpreter-not-shebang` is about an interpreter that was **already
  chosen** and runs the file in the wrong language, failing loudly. Here nobody chose an
  interpreter.

Rather than accept the argument, it was measured — `evidence/probe-sh.mjs` — and the
measurement is worse than either win-hooks or the reviewer described:

```
CreateProcess direct (spawn)   code=null  err=EFTYPE
cmd /c hook.sh                 code=0     out=""     <- ran nothing, reported success
cmd /c call hook.sh            code=0     out=""
cmd /c start /wait hook.sh     code=0     out=""
powershell  & hook.sh          code=0     out=""
bash hook.sh                   code=0     out="MARKER_OK"

assoc .sh -> .sh=sh_auto_file
PATHEXT   -> .COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL
```

`.sh` is not an executable type, so `CreateProcess` refuses it — but Git for Windows
**does** register the extension, so every shell-level dispatcher resolves the
association, finds no executing verb, does nothing, and returns 0. An association that
exists and does nothing is worse than none, because "none" produces a readable error.

That is a silent failure, which is this corpus's sharpest category, and no existing case
stated it. Shipped as `dot-sh-association-exits-zero`, `repro: verified`, with two new
ontology nodes.

## What this says about the first round

The original rejection of CASE-07 was filed under "already covered", and it was wrong.
Two independent analysts then re-confirmed the same wrong answer, because both inherited
the framing rather than re-deriving it. The only thing that caught it was dispatching a
reviewer whose instruction was to attack the consensus, and then measuring instead of
arguing. Worth remembering the next time a re-examination comes back unanimous.

The other 23 rejections are upheld, including the challenger's own strongest alternative
(CASE-02), which it declined to overturn.

