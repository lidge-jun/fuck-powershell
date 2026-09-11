# wp5 — Integration

No new cases. This phase turns 10 loose files into a corpus the tooling agrees with, and
puts the round on `main`.

## Steps, in dependency order

1. **Rebuild and validate the graph.**
   `bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs`.
   `ontology/graph.json` and `ontology/INDEX.md` are in `.gitignore`: they are generated
   locally and **not** committed, and CI rebuilds them inside the docs build. Record the
   before/after node and edge counts; the round's growth is the evidence for criterion c3.
   V11 is the one that catches a case file whose stem and graph id drifted.

2. **Re-run the schema gate over the whole corpus.**
   `bun scripts/lint-cases.mjs` must print `108 cases OK`. It walks every file, so it
   observes all 10 additions — this is the verifier that genuinely reads the change target.

3. **Regenerate the agent skill and reinstall it.**
   `bun scripts/build-skill.mjs` then `bun scripts/install-skill.mjs`, then
   `bun scripts/install-skill.mjs --check` to prove the installed copy is not stale. The
   install is a copy rather than a symlink, so this step is mandatory after any corpus
   change; `--check` is the only thing that reports drift.

4. **Correct every count that went stale.**
   `README.md` currently opens with "87 reproducible cases" and "303 nodes, 618 edges",
   all three already wrong before this round. Update them from `build-graph` output rather
   than by arithmetic, and check `skills/powershell-landmines/SKILL.md` and the docs-site
   for the same numbers. Grep for the literals so none is missed:
   `rg -n "\b(87|98|303|618)\b" README.md skills docs-site`.

5. **Record the round.**
   Add `devlog/260911_winhooks/040_ship.md` — what was added, what was rejected and why,
   the gate output, and the `related_to` verdict from wp2. Written for someone who was not
   in the loop.

6. **Merge.**
   `git checkout main && git merge --no-ff codex/winhooks-cases`. One merge commit,
   message naming the round and the 98 -> 108 delta. Then `git status` must be clean apart
   from the untracked session file `.codexclaw/sessions/<id>.json`, which is loop state and
   is not part of this round.

## Out of scope, explicitly

- `git push`. The branch and the merge are local. Publishing to `origin` needs the user's
  approval and is not implied by "merge to main".
- Filing issues upstream on win-hooks.
- Any edit to `lint-cases.mjs`, `build-graph.mjs` or `validate-graph.mjs`.

## Acceptance

| Criterion | Evidence |
|---|---|
| c1 dedupe | the ledger in `000_plan.md`, sourced from four independent subagent searches |
| c2 schema | `lint-cases.mjs` prints `108 cases OK` |
| c3 graph | `build-graph` + `validate-graph` exit 0 with grown counts |
| c4 citations | each new case's `refs` resolve live |
| c5 skill | `install-skill.mjs --check` exits 0 |
| c6 counts | `rg` finds no stale 87/303/618 in README, skill or docs-site |
| c7 merge | `git log --oneline --graph` on `main` shows the merge; `git status` clean |
