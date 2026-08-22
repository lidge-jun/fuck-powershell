# 080 — Follow-up round: closing the three open items

The five-repo round left three items in `070_closeout.md`. All three are now
closed, and two of them changed the corpus in ways worth recording.

## The Go-port rejection was wrong

wp5 rejected roughly 40 Go-port rows wholesale after reading ten, and recorded
that as a band judgment inviting a cheap re-read. The re-read found the judgment
backwards.

A dispatched explorer ran `git patch-id --stable` across all 50 Go-port rows and
found they collapse to SEVEN unique patches, each re-landed up to eight times
across branches. So the original sample of ten was mostly re-reading the same
diffs, and the real question was only ever seven patches wide. Three of the seven
carry mechanisms the corpus did not own:

| case | mechanism |
|---|---|
| icacls-inheritance-r-empty-dacl | removing inheritance before granting leaves an empty DACL that denies the owner, and the repair needs access you just removed |
| tcp-tcb-survives-listener | a closed socket's TCB keeps the port unbindable, and SO_REUSEADDR means something different on Windows than it does on Linux |
| file-url-encodes-backslash | a conforming URL builder percent-encodes the separators, producing a valid URL that points nowhere |

The other four hold: WinSW-versus-scheduler selection is product surface,
task-XML validation is the workaround `localized-cli-output-parsing` already
teaches, the tray's window flags are `windowstyle-hidden-vs-windowshide`, and the
WinSW status greps are the same localized-output trap.

**The lesson is about sampling, not about Go.** When an inventory contains
cherry-picked or re-landed commits, sampling the block samples the BRANCHES
rather than the patches. One `patch-id` pass before sampling would have made the
original ten meaningful. That is now the rule for any future block judgment.

## 9122d5ebe was split out

It had been REFed to `redirected-ps-output-mojibake` on the reasoning that both
are "an identity-derived path degrading silently". Re-reading settled it against
that: the mojibake case is a value destroyed in transit by a console codepage,
and this one is an API returning an empty string instead of failing. Different
sentence, different fix, different reader — one is debugging garbled characters,
the other a path that silently became relative. It is now
`known-folder-empty-not-error`.

## Two cases written from documentation

Reserved device names and MAX_PATH have no evidence in any of the five mined
histories, which is exactly why they were still missing: this corpus had been
growing by commit mining, and commit mining only finds what somebody already hit
and fixed in these repos. Both are among the most commonly encountered Windows
traps in the world, and an archive that exists as a lookup surface for agents
should not lack them because of how it happens to be sourced.

They are `source: third-party` with Microsoft citations, and both carry a
`## Verification note` stating plainly which claims are quoted documentation and
which are documented-behavior inference. The research lane was explicitly asked
to separate the two and returned an UNCERTAIN section listing what it could not
confirm — for example whether an extended-length-prefixed `nul.txt` actually
creates a real file, and whether the shipped `node.exe` binary merges a manifest
its source tree does not declare. Those uncertainties are reflected as hedges in
the case text rather than smoothed over.

This is a deliberate widening of how the corpus grows: mined cases remain the
backbone, and documented mechanisms are admissible when they are load-bearing,
cited, and honest about what was executed.

## Result

70 -> 76 cases. Ontology 251 nodes / 526 edges -> 268 / 563. All five mining
coverage checks still at 100 percent, since the three promoted Go-port rows were
re-dispositioned in place rather than added.

Issues 35-40 were created for the six new cases and cross-linked into their refs,
matching how 1-34 are already registered. Issues 19-34 from the previous round
were closed with a registration comment linking the case file and its live page,
which is the convention 1-18 established.
