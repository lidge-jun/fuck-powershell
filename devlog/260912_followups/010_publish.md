# wp1-publish

## What

Push `main` to `origin/main` and confirm the Pages deploy workflow for that commit
succeeds.

## Pre-publication audit, and what it found

An independent `xai/grok-4.6` reviewer read `git diff origin/main..main` plus the
commit history and returned **NOT-SAFE**, for one reason: the working tree was clean,
but three lines inside the *history* carried this machine's Windows account name.
`git log origin/main` showed zero prior occurrences, so pushing would have published
it for the first time.

Everything else was clean: no secrets or tokens, no gitignored files that slipped in,
no TODO or placeholder text, well-formed citation URLs, and the ten new cases matching
the schema documented in README.

## Disposition

The commits were unpushed, so the history could be corrected without affecting anyone.

1. `git branch backup-before-scrub main` — recoverable if anything goes wrong.
2. `git filter-branch -f --tree-filter "node <scrubber>" origin/main..main`, replacing
   the account name with the `C:\Users\you` placeholder the new cases already use.
3. Verify: `git log origin/main..main -S"Users\super"` returns nothing, the merge
   commit and all five branch commits survive with their messages, and
   `git diff backup-before-scrub main --stat` is **empty** — the final tree is
   byte-identical, only the intermediate history changed.

The tracked `.codexclaw/ledger.jsonl` had to be stashed first, because filter-branch
refuses to run with unstaged changes, and popped afterwards.

## What CI does and does not prove

`.github/workflows/deploy.yml` fires on push to main and runs `bun run build` in
`docs-site`, which is `build-graph && validate-graph && lint-cases` followed by
`sync-cases && sync-ontology`. So the push genuinely exercises the whole pipeline.

It does **not** prove the CRLF fixes made in the previous round. `.gitattributes`
pins `* text=auto eol=lf`, so the Linux runner checks out LF files and never reaches
the branch that was broken. Those fixes are proven locally and only locally. Say so
rather than letting a green tick imply more than it shows.

## Accept criteria

- `git log origin/main` contains the merge commit.
- The workflow run for that commit has conclusion `success`, read from the API rather
  than assumed.
- Gates still pass locally on the rewritten history.

