# 080 — Follow-up round: closing the three open items

The five-repo round left three items in `070_closeout.md`. All three are now
closed, and two of them changed the corpus in ways worth recording.

## The Go-port rejection was wrong

wp5 rejected roughly 40 Go-port rows wholesale after reading ten, and recorded
that as a band judgment inviting a cheap re-read. The re-read found the judgment
backwards.

A dispatched explorer ran `git patch-id --stable` across the 44 rows labeled as Go-port work and
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

The A-gate reviewer recounted the rows and found 44 labeled ones rather than 50,
which is corrected above and in 050. The seven-patch collapse and every
disposition that followed from it survive the recount.

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

## The audit found three factual errors

The A gate on these six cases returned FAIL, and the useful part is that three
findings were wrong FACTS rather than wrong wording. All three came from writing
confidently about behavior nobody in this loop had executed.

**Node does not percent-encode backslashes.** The file-URL case asserted it did.
The WHATWG URL standard treats `file:` as a special scheme and maps backslash to
forward slash, which a local run on Node v24.17.0 confirms. The real defect lives
in Go's `net/url`, which follows the RFC. The case now leads with Go and names
the asymmetry itself as the hazard: identical logic is correct in one language
and broken in another, so a port acquires the bug silently.

**SO_REUSEADDR was backwards.** The TCP case said Windows `SO_REUSEADDR` fails to
waive `TIME_WAIT`. It waives it — and also permits hijacking a live listener,
which is exactly why libuv refuses to set it. "The POSIX fix does not work here"
became "the POSIX fix works and is a security hole, so your runtime already
refused it for you", which is a different and more useful sentence.

**The wrong known-folder flag.** `KF_FLAG_DEFAULT_PATH` sounds like "just answer",
but it asks for the default rather than redirected path and still verifies
existence. `KF_FLAG_DONT_VERIFY` is the one that returns a path for a folder that
does not exist. The case had also asserted the lookup resolves through
`USERPROFILE`, which no Microsoft page states, so the repro was re-anchored on
the folder being absent.

Two more were overclaims. The icacls title said the owner could not repair the
file, while the body's own `/grant` line worked — ownership implies `WRITE_DAC`.
And the MAX_PATH repro built a 240-character directory under `%TEMP%`, which is
already 30 to 50 characters, so the first create exceeded the limit and the
demonstration never ran.

One structural fix came out of it. Lint required a commit or PR URL for every
`third-party` case, so the two documentation-sourced cases had been given an
unrelated chore commit to satisfy it. That is worse than citing the spec, so the
rule now accepts an authoritative vendor documentation URL — which is what a
documented-mechanism case actually rests on.

## Result

70 -> 76 cases. Ontology 251 nodes / 526 edges -> 271 / 563. All five mining
coverage checks still at 100 percent, since the three promoted Go-port rows were
re-dispositioned in place rather than added.

Issues 35-40 were created for the six new cases and cross-linked into their refs,
matching how 1-34 are already registered. Issues 19-34 from the previous round
were closed with a registration comment linking the case file and its live page,
which is the convention 1-18 established.
