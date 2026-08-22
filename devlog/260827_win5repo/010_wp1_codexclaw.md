# 010 — wp1 codexclaw

Inventory: inv/win_codexclaw.txt, 28 SHAs, Tier B grep, prior-round SHAs excluded.

## What this repo can plausibly contribute

codexclaw is a Codex plugin: hooks, a cxc CLI, subagent spawn wrappers, and a
state machine persisted to JSON. Its Windows exposure is concentrated in four
places, and those are the only places a NEW case can come from.

1. Spawn surface — the plugin spawns subagents and shells out to cxc. Any
   .cmd/.ps1 shim, argv rebuild, or ComSpec hop here is Windows mechanism, but
   spawn-npm-enoent-einval, npm-ps1-not-comspec, and cmd-shim-reparses-argv
   already own most of that ground. The bar for a fourth spawn case is high.
2. Path handling — path.delimiter, realpath, symlinked installs, checkoutRoot
   fallbacks. node-path-host-delimiter owns the delimiter trap; a realpath or
   symlink mechanism would be new if it is Windows-relevant.
3. Hook exec guards — direct-exec detection compares __filename to
   process.argv[1]. On Windows that comparison has extra failure modes (drive
   letter casing, short 8.3 names, forward vs back slashes) that no existing
   case covers.
4. CI lanes — the repo runs Windows CI and has commits skipping or fixing tests
   there. Test-only plumbing is REJECT; a genuine runner-semantics difference is
   ci-agents material.

## Expected disposition shape

Most of the 28 are plugin-internal (feat(pabcd), docs(devlog), refactor(hooks))
and will REJECT as repo-specific or docs-only. The Windows-labelled minority is
where NEW candidates live: the planUnit segment comparison, the CLI entry-point
guard, the three windows CI test failures, the 3-way service dispatch with CRLF
tolerance, and the 5 P0 Windows blockers. A yield of one to three NEW cases is
the realistic expectation; zero is acceptable if the diffs are repo-internal.

## Candidate mechanisms to check explicitly

Hypotheses to test against the diffs, not pre-approved cases.

- Path-segment comparison. A test comparing paths as strings passes on POSIX and
  fails on Windows because the separator differs; the fix compares segments. If
  the underlying claim is that string equality is not path equality on Windows,
  that is distinct from node-path-host-delimiter (which is about the PATH-list
  delimiter, not the path separator) and belongs in env-paths.
- Entry-point guard. import.meta.url compared against argv[1] breaks when the
  install is symlinked, and the Windows half is that drive-letter casing and
  slash direction both defeat string equality. Category env-paths.
- CRLF tolerance. If the fix is that our parser assumed LF, that is
  repo-specific. If it is that a stock tool writes CRLF and a POSIX-shaped
  consumer sees an invisible trailing CR, that is a real encoding mechanism and
  the corpus has no CRLF case at all today.
- Windows CI runner defaults. actions-default-shell already owns the fact that
  GitHub Actions runs pwsh by default. A commit about runner spawn timeouts is
  repo-specific.

## Build steps

1. Re-read every analyst-cited diff before writing anything.
2. For each accepted NEW: create cases/<category>/<id>.md with full frontmatter,
   the ontology block, and the four required sections. Add any missing mechanism
   concept under ontology/concepts/.
3. For each REF: append the commit URL to the target case refs list. No prose
   changes to that case unless the new evidence contradicts it.
4. Write the full 28-row disposition table into this document.
5. Regenerate: build-graph, validate-graph, build-skill; run lint-cases; build
   the site.

## Acceptance

- 28 of 28 SHAs appear in the disposition table.
- lint-cases exit 0; validate-graph 0 violations; skill regenerates; site builds.
- Every NEW case cites a reachable commit URL on github.com/lidge-jun/codexclaw.

## Analyst return (grok-4.6, 28/28)

Two NEW, twenty-six REJECT. The REJECT tail is almost entirely plugin-internal
work — PABCD state machine, hook payload rewrites, devlog prose — which matches
what this repo was expected to yield.

## Overturned prior REJECT (required by 001 §Prior REJECTs are not binding)

`esm-is-main-file-url` overturns a prior-round decision. In the 260824 round the
analyst dispositioned codexclaw `098c6da0` ("fix(scripts): repair the CLI
entry-point guard on Windows") as REJECT with the reason "Node ESM file://+path vs
pathToFileURL (file:///D:/...); not PS/shell-spawn".

That reason was scope, not correctness, and the scope has since widened: the README
now states plainly that PowerShell is the brand while the corpus is the whole
Windows interop minefield. A stock-Node entry guard that can never fire on Windows
belongs in that corpus. The overturn is recorded here and in the disposition row.

## Narrowing the esm case

The analyst's proposal bundled two failures and only one of them is ours. The
identity sentence is the FILE-URL CONCAT:

> `import.meta.url === \`file://\${process.argv[1]}\`` can never be true on Windows,
> because Node produces `file:///D:/...` (three slashes, drive letter, forward
> slashes) while `argv[1]` is `D:\\...`.

The symlink/realpath half of `31937142` fails identically on macOS and Linux — that
is a cross-platform bug, not a Windows mechanism, and it stays out of the case body
except as the reason the commit exists. The case is written around the concat, with
the symlink issue named only as the adjacent trap.

## Caveat carried into the CRLF case

`split-n-leaves-cr` comes from `2c3801a1`, which introduced the `split("\\n")`
parser and its `\\r?` tolerance in the SAME commit. It is not a shipped-then-broken
incident; the commit's own CRLF fence test is the evidence. The mechanism is stock
(a four-line Node repro reproduces it) so the case stands, and `repro: historical`
plus this note keeps the provenance honest.

## Disposition table

| sha | disposition |
|---|---|
| b751b3db | REJECT repo-specific |
| 543a4028 | REJECT repo-specific |
| e70c8456 | REJECT repo-specific |
| ef06fa0e | REJECT test-only |
| 0090d672 | REJECT docs-only |
| e1f48dc9 | REJECT repo-specific |
| c1558c7d | REJECT repo-specific |
| 503c2bb7 | REJECT docs-only |
| c8df1647 | REJECT repo-specific |
| 364730bb | REJECT docs-only |
| dd92b90a | REJECT docs-only |
| 850b4343 | REJECT refactor |
| f17ae702 | REJECT repo-specific |
| aa227ffc | REJECT repo-specific |
| 2c3801a1 | NEW split-n-leaves-cr |
| d0a31c7b | REJECT test-only |
| 31937142 | NEW esm-is-main-file-url (overturns 098c6da0 REJECT: "not PS/shell-spawn") |
| 52f174dc | REJECT docs-only |
| a279cd44 | REJECT repo-specific |
| 3d905edf | REJECT docs-only |
| e6ccfc45 | REJECT docs-only |
| b246f448 | REJECT docs-only |
| 05136868 | REJECT test-only |
| a1c6e2b6 | REJECT repo-specific |
| 9c405c18 | REJECT repo-specific |
| bdf09969 | REJECT repo-specific |
| ddfadb7b | REJECT docs-only |
| 3579b9d1 | REJECT docs-only |

## Judgment calls carried from the analyst

- `543a4028` shows a `path.relative()` backslash-vs-slash planUnit assertion, but
  that line is pre-existing context, not introduced by this commit. The real
  Windows CI fix (`39526dde`) is outside this inventory. A
  "string equality is not path equality on Windows" case is therefore NOT written
  in wp1; it stays a live candidate for a later round with its own evidence.
- `503c2bb7` narrates `path.delimiter` versus drive letters, which
  `path-colon-not-delimiter` and `node-path-host-delimiter` already own. Docs of a
  prior fix, so REJECT docs-only rather than REF.
- The five spawn-surface SHAs rewrite Codex hook payloads and never hop through
  `.cmd`, PATHEXT, or ComSpec, so they are not a fourth spawn case.
