# 060 — wp6 ship

Runs only after all five ledgers close.

## What ships

1. Issues. Every NEW case from wp1 through wp5 gets a GitHub issue on
   lidge-jun/fuck-powershell in the schema the existing 18 use: title is
   "<category>: <symptom sentence>", body carries Symptom, Repro, Cause,
   Workaround. The case file refs list gains the issue URL, matching how cases 1
   through 18 already cross-link. Issue creation is what makes the archive
   searchable from outside the repo, which is the point of the project.
2. Counts. The docs-site index counts ARE generated, by sync-cases.mjs. README is
   not: it hardcodes the corpus size in two places, the tagline and the layout
   table, and no script rewrites it. README is a manual edit checked against
   "find cases -name '*.md' | wc -l", and that check belongs in the ship evidence.
3. Ontology. Final build-graph and validate-graph over the whole corpus, with the
   concept count reported in the D summary so the mechanism-to-case ratio stays
   visible.
4. Skill. build-skill regenerated against the final case set so the installable
   skill reference tables match the corpus.
5. Push. git push origin on the working branch, then confirm the Pages
   deployment succeeded and the live site serves the new cases.

## Ordering

Issues before README counts, because the case files gain issue URLs and that edit
changes the files the counts are computed from. Push last.

## Acceptance

- Every NEW case from this round has an issue whose title matches its case title,
  counted by matching "<category>:" titles rather than by assuming the repo has
  exactly 18 pre-existing issues.
- README count, site count, and the find count all agree.
- validate-graph reports 0 violations over the full corpus.
- Pages deployment green, and the live URL serves at least one new case page.

## Push authorization

Pushing is an external state change and stays gated on the user's explicit
approval. The user pre-authorized publishing THIS archive repo publicly, which
covers "git push origin" on this working branch and nothing else: no other repo,
no force-push, no tags.

## Evidence to capture

The gh issue list count, the README count grep, the push output with the pushed
SHA, and the deployment status.
