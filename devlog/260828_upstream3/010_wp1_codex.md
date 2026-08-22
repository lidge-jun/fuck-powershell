# 010 — wp1 openai/codex

Inventory: `inv/t1_codex.txt` (44 commits), `inv/issues_codex.txt` (176 open issues).

## Surface

codex is a Rust CLI with a sandbox, an exec layer, a PTY, and an apply-patch
implementation. Its Windows exposure differs from every repo mined so far in one
structural way: **Windows has no seccomp or landlock equivalent**, so the sandbox
is not a port of the POSIX design but a different design. That is the most
promising vein here, because the corpus has nothing about Windows process
isolation at all.

Four surfaces worth reading in full, all visible in the frozen inventory:

1. **WSL UNC paths.** Three commits skip ACL refresh for WSL UNC roots. A
   `\\\\wsl.localhost\\...` path is a UNC path that Win32 APIs accept and most
   path logic does not expect, and ACL operations against it behave differently
   from a local path. The corpus has no UNC case.
2. **cmd.exe session env capture.** Two commits about capturing and re-supplying
   the environment from a `cmd.exe` session. Environment inheritance across a
   shell hop is where `cmd-posix-env-prefix` and `envpath-pollutes-user` live, so
   the bar for a third case here is high.
3. **PathUri drive-letter canonicalization.** A documentation commit, which
   usually means REJECT docs-only — but the underlying rule (how a drive letter
   canonicalizes inside a URI) is adjacent to `file-url-encodes-backslash` and
   `dynamic-import-needs-file-url`, so read it before deciding.
4. **apply-patch and CRLF.** `split-n-leaves-cr` and `lf-pure-transform-mixes-eol`
   already own the read and write sides of CRLF residue. A third CRLF case needs a
   sentence neither owns — patch-application semantics might supply one, since a
   diff whose context lines have CRs will not apply against LF content.

## Expected shape

Most of the 44 commits will REJECT as test-only or CI. The 176 open issues are
the larger unknown, and the more interesting one: 176 unresolved Windows reports
against a widely used CLI is a lot of unfixed reality.

Realistic yield: one to three NEW. Zero is acceptable if everything is already
owned — the corpus is 76 cases deep and that is the point of the dedupe bar.

## Build steps

1. Re-read every anchor the explorer cites, first-hand, before writing anything.
2. Write accepted cases with full frontmatter, an ontology block, and the four
   required sections; add any missing mechanism concept.
3. Append refs to existing cases for REF rows.
4. Fill the disposition table for all 44 commits and all 176 issues.
5. Regenerate graph and skill, run the gate chain, dispatch the A-gate reviewer.

## Acceptance

- 44/44 commits and 176/176 issues dispositioned.
- Gate chain green; the five prior mining coverage checks unchanged.
- Every NEW case cites a reachable github.com/openai/codex commit or issue URL.

## Disposition table

Filled during B.
