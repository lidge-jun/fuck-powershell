---
id: workaround-chdir-away-before-delete
type: Workaround
label: "chdir away before delete"
---

## Definition

Move the process out of the temp directory before removing it so the delete succeeds.

## Why it's unsafe

It destroys the test: the code under test now runs with a valid cwd and the unlinked-cwd assertion proves nothing.

