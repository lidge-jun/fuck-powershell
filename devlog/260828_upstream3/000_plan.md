# 000 — Upstream mining: codex, hermes-agent, openclaw

## Why go upstream

The corpus is 76 cases and every one of them came from five first-party repos.
That is a real limitation, not a milestone: those five codebases hit the Windows
traps that their particular shapes hit — Node CLIs, a Bun agent, an image tool, a
browser driver, a Rust/TS coding agent. Mechanisms nobody in that set happened to
trip are structurally invisible to first-party mining, no matter how thorough the
coverage gate is.

Two of the previous round's cases already proved the point from the other
direction: reserved device names and MAX_PATH had to be written from Microsoft
documentation, because five repos' worth of history contained no evidence of
either, while both are among the most commonly hit Windows walls in the world.

These three upstream repos are the fastest available correction. They are large,
independent, actively Windows-supporting agent runtimes in THREE DIFFERENT
LANGUAGES, which is what makes them worth the clone:

| repo | language | commits | why it is here |
|---|---|---|---|
| openai/codex | Rust | 9,685 | the upstream this project's owner forked; a sandbox and exec layer with no POSIX equivalent on Windows |
| NousResearch/hermes-agent | Python | 24,571 | the only Python source in scope, and the corpus has almost no Python-side Windows behavior |
| openclaw/openclaw | TypeScript | 81,534 | the largest, with heavy real-world Windows usage across terminal, watcher, and IPC surfaces |

The language spread matters more than the star count. A Windows mechanism that
bites Python's `subprocess` differently than Node's `child_process` is a
different sentence for the reader, and the corpus currently tells only the Node
half of several such stories.

## Open issues are evidence

This round admits OPEN ISSUES alongside merged commits, which is new. A commit is
evidence that someone hit a wall and fixed it; an unresolved issue with a clear
reproduction is evidence that someone hit a wall and it is STILL THERE. For a
lookup surface aimed at agents about to write Windows-touching code, the second is
at least as useful as the first.

The judgment is on the REPORT, not on the maintainers' response. A `wontfix` or a
stale-bot close says something about that project's priorities and nothing about
whether the mechanism is real.

## Frozen inventories

Commits: `git log --all` subject grep, Tier 1 only — the subject must name a
concrete Windows MECHANISM (`.ps1`, comspec, pathext, crlf, cp949, codepage,
lastexitcode, execution-policy, appexec, utf-16, `.cmd`, `.bat`, drive-letter,
unc, msys, cygwin, mingw, bom, backslash, shebang, long-path, max_path,
reserved-device, win32, cmd.exe, winget), not merely the word "windows". Merge
commits excluded.

Issues: `gh api search/issues` over five Windows-flavored queries per repo
(`windows powershell`, `windows path`, `windows encoding`, `windows spawn`,
`windows crlf`), open only, deduplicated by number.

| repo | commits | open issues |
|---|---|---|
| codex | 44 | 176 |
| hermes-agent | 129 | 159 |
| openclaw | 232 | 105 |

845 rows total. The narrow commit tier is deliberate: a broad grep over 115,790
commits produced 3,569 rows, which is not reviewable, and the term list is
precisely the set that survived four earlier mining rounds as predictive.

**Non-goal, stated plainly:** this is inventory coverage, not repository coverage.
A Windows fix in these repos whose subject says nothing Windows-ish is invisible
to this round, exactly as it was to the previous ones.

## Work-phase map

| wp | unit | doc |
|---|---|---|
| wp0 | roadmap (this cycle, docs-only) | 000 |
| wp1 | openai/codex | 010 |
| wp2 | NousResearch/hermes-agent | 020 |
| wp3 | openclaw/openclaw | 030 |
| wp4 | ship | 040 |

Ordered smallest inventory first, same reasoning as the five-repo round: dedupe
quality rises as the corpus grows, so the largest inventory should meet the
largest corpus. codex is also the most familiar surface, which makes it the right
place to calibrate the bar before spending it on 232 openclaw commits.

## Read-only contract

The three clones under `040_upstream/` are mining sources. No commits, no
branches, no PRs against them, ever. The only repository this round writes to is
fuck-powershell.

## Acceptance per work-phase

1. `bun scripts/lint-cases.mjs` exits 0.
2. `bun scripts/build-graph.mjs` then `bun scripts/validate-graph.mjs`, 0 violations.
3. All five PRIOR mining coverage checks still report 100 percent — this round
   must not disturb the earlier ledgers.
4. `bun scripts/build-skill.mjs` leaves drift limited to the new cases.
5. `cd docs-site && bun run build` exits 0.
6. Every row of that repo's two inventories carries a disposition.

## Evidence bar

Every accepted case cites a reachable upstream commit or issue URL. No Windows
host exists in this loop, so cases are `repro: historical` unless behavior was
actually executed, and any claim resting on documentation rather than observation
carries a verification note naming what was quoted versus inferred. The previous
round's audit caught three factual errors that came from writing confidently about
unexecuted behavior; that is the failure mode this bar exists to prevent.
