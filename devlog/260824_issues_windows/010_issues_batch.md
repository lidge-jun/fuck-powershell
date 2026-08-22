# 010 — Issue registration batch (iw2)

For each issue 1-11: parse issue_NN.json body; strip the bold metadata header
line (Category/Versions/Failure/Context/Source/Repro) into frontmatter enums;
normalize versions ("5.1 (measured), likely both" → "5.1" with prose note; "both"
stays); keep Symptom/Repro/Cause/Workaround sections (rename "Workaround
(verified)" → "Workaround"); drop "Relationship to existing cases" sections into
a plain paragraph at body end (no new section heading); refs = issue URL
(https://github.com/lidge-jun/fuck-powershell/issues/NN). id per 000 table.
Lint after all 11. Commit. Issues NOT closed here — closing happens in iw4 after
the pages are live so comments can link live URLs.
