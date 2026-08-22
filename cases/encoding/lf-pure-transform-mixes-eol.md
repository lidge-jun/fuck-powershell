---
id: lf-pure-transform-mixes-eol
title: "editing one section of a CRLF file with LF-pure string code leaves a mixed-EOL file that every later diff and hash disagrees about"
category: encoding
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/opencodex/commit/22561a4598bb75e7b254474c1f998f025dda7a58
  - https://github.com/lidge-jun/opencodex/commit/b394b035b
ontology:
  affects: [runtime-node, runtime-bun, env-windows]
  caused_by: [mechanism-crlf-residue]
  mitigated_by: [workaround-eol-boundary-normalization]
---

# editing one section of a CRLF file with LF-pure string code leaves a mixed-EOL file that every later diff and hash disagrees about

## Symptom

Your tool edits a config file — injects a section, removes a block, rewrites a
key — and the result looks perfect. Then, days later:

- a diff shows the whole file changed when you touched four lines
- a content hash you store for change detection never matches again
- an idempotent operation is not idempotent; running it twice produces a third
  state
- a block your remove-function knows how to match no longer matches, so removal
  reports success and removes nothing

The file is now half CRLF and half LF, and nothing in your editor shows it.

## Repro

```js
// a config that was written on Windows
const original = "a=1\r\nb=2\r\n";

// an ordinary LF-pure transform: split, insert, join
const lines = original.split("\n");
lines.splice(1, 0, "injected=true");
const result = lines.join("\n");

JSON.stringify(result);
// "a=1\r\ninjected=true\nb=2\r\n"
//        ^^^^ original CRLF   ^^ your new LF
```

Two lines now end differently from their neighbours. Open it in any editor and it
looks identical to what you intended.

## Cause

Nearly all line-oriented string code is LF-pure: it splits on `"\n"`, joins with
`"\n"`, and builds new lines with `"\n"` in template literals. That is correct
for the lines it CREATES and wrong for the file it creates them in, because the
existing lines kept their CRs — `split("\n")` leaves them attached to the ends of
the elements rather than consuming them.

So the transform silently mixes terminators, and each downstream consumer breaks
differently:

- **git** with `core.autocrlf` normalizes on the way in, so the file that looked
  fine locally arrives changed everywhere
- **content hashes** cover bytes, and the bytes moved
- **your own remove-function**, if its pattern is LF-only, will not match the
  block it just wrote in a CRLF context — that is how a removal reports success
  while the block stays in the file and keeps taking effect

The last one is the expensive shape, because the tool tells you the state is one
thing and the file says another.

## Workaround

Normalize at the boundary and restore on write, rather than teaching every
transform about CRLF:

```js
function dominantEol(text) {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  if (crlf === 0) return "\n";
  const bareLf = (text.match(/\n/g) ?? []).length - crlf;
  return crlf >= bareLf ? "\r\n" : "\n";
}

function applyEol(text, eol) {
  const lf = text.replace(/\r\n/g, "\n");
  return eol === "\n" ? lf : lf.replace(/\n/g, "\r\n");
}

const raw = readFileSync(path, "utf8");
const eol = dominantEol(raw);                 // measure BEFORE touching anything
let content = applyEol(raw, "\n");            // LF-pure interior
content = yourExistingTransforms(content);    // unchanged
writeFileSync(path, applyEol(content, eol));  // restore on the way out
```

Two details worth keeping. Measure the dominant ending from the ORIGINAL bytes,
not after any transform, or a file that was already mixed drifts further each
run. And if you hash for change detection, hash the FINAL bytes you wrote — a
hash of the LF interior will never match the file on disk.

Any pattern that matches a line you wrote earlier needs `\r?` for the same
reason: `/^# BEGIN block$/m` does not match `# BEGIN block\r`.

---

`split-n-leaves-cr` is the read side of this mechanism: a CR survives into a
comparison and a match fails. This is the write side — the CRs you did not
consume stay in the file and the ones you add are missing, so the artifact itself
becomes inconsistent.
