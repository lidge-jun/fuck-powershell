import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildGraph, createIndex, search, preflight, errors, getCase, parseCaseMarkdown, corpusSignature, loadSnapshot, resolveRoot } from "../scripts/lib/fp-core.mjs";
import { symlinkSync } from "node:fs";

function git(root, ...args) {
  const r = spawnSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "fp-core-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "cases", "sample"), { recursive: true });
  mkdirSync(join(root, "ontology", "concepts"), { recursive: true });
  writeFileSync(join(root, "ontology", "concepts", "runtime.md"), "---\nid: runtime-node\ntype: Runtime\nlabel: Node\n---\n");
  writeFileSync(join(root, "cases", "sample", "first.md"), "---\nid: first\ntitle: First Case\ncategory: sample\nversions: \"both\"\nfailure: enoent\nrefs:\n  - https://example.com/a\n  - https://example.com/b\nontology:\n  affects: [runtime-node]\n  manifests_as: [error-enoent]\n---\n\n# First Case\n\n## Symptom\n\nFailure.\n\n## Repro\n\nRun it.\n\n## Cause\n\nCause.\n\n## Workaround\n\nFix.\n");
  git(root, "init", "-q"); git(root, "add", "."); git(root, "commit", "-qm", "initial");
  return root;
}

test("graph and lookup preserve public shapes", t => {
  const root = fixture(t), ix = createIndex(buildGraph(root));
  assert.equal(search(ix, "first")[0].id, "first");
  assert.deepEqual(preflight(ix, { runtime: "node" }), {
    risk: "medium", cases: [{ id: "first", title: "First Case", file: "cases/sample/first.md", category: "sample", failure: "enoent", score: 1, reason: ["affects:runtime-node"] }], constraints: []
  });
  assert.equal(errors(ix, "enoent").cases[0].id, "first");
  assert.equal(errors(ix, "error-enoent").signature, "error-enoent");
  assert.equal(getCase(ix, root, "missing"), null);
  assert.match(getCase(ix, root, "first").markdown, /## Workaround/);
});

test("case markdown parses CRLF, refs and sections", t => {
  const root = fixture(t);
  const markdown = readFileSync(join(root, "cases", "sample", "first.md"), "utf8").replace(/\n/g, "\r\n");
  const parsed = parseCaseMarkdown(markdown);
  assert.equal(parsed.title, "First Case");
  assert.equal(parsed.versions, "both");
  assert.deepEqual(parsed.refs, ["https://example.com/a", "https://example.com/b"]);
  assert.equal(parsed.sections.Workaround, "Fix.");
  assert.equal(parsed.sections.Symptom, "Failure.");
  assert.equal(parseCaseMarkdown("---\ntitle: Fallback\n---\n").title, "Fallback");
  assert.deepEqual(parseCaseMarkdown("# Plain").refs, []);
  assert.equal(resolveRoot(import.meta.url, { FP_HOME: root }), root);
});

test("snapshot keeps corpus head distinct from checkout head", t => {
  const root = fixture(t);
  const initial = loadSnapshot(root, null), firstHead = initial.head;
  assert.equal(initial.caseCount, 1);
  writeFileSync(join(root, "README.md"), "new"); git(root, "add", "."); git(root, "commit", "-qm", "readme");
  const busy = loadSnapshot(root, initial, { isBusy: () => true });
  assert.equal(busy.head, firstHead);
  assert.notEqual(busy.checkoutHead, firstHead);
  const same = loadSnapshot(root, initial);
  assert.equal(same.ix, initial.ix);
  assert.equal(same.head, same.checkoutHead);
  assert.notEqual(same.head, firstHead);
  writeFileSync(join(root, "cases", "sample", "second.md"), "---\nid: second\ntitle: Second\ncategory: sample\n---\n# Second\n");
  const rebuilt = loadSnapshot(root, same);
  assert.equal(rebuilt.caseCount, 2);
  assert.notEqual(rebuilt.sig, same.sig);
  assert.equal(rebuilt.head, rebuilt.checkoutHead);
});

test("rebuild failure serves old index and recovers", t => {
  const root = fixture(t), initial = loadSnapshot(root, null);
  const concept = join(root, "ontology", "concepts", "runtime.md");
  writeFileSync(concept, "---\nid: runtime-node\n---\n");
  const failed = loadSnapshot(root, initial);
  assert.equal(failed.ix, initial.ix);
  assert.equal(failed.head, initial.head);
  assert.equal(failed.sig, null);
  assert.match(failed.warning, /^corpus rebuild failed: concept missing id\/type/);
  assert.throws(() => loadSnapshot(root, null), /concept missing id\/type/);
  writeFileSync(concept, "---\nid: runtime-node\ntype: Runtime\n---\n");
  const recovered = loadSnapshot(root, failed);
  assert.equal(recovered.caseCount, 1);
  assert.equal(recovered.warning, undefined);
});

test("unstable reads retry once, then fall back or throw", t => {
  const root = fixture(t), initial = loadSnapshot(root, null);
  const file = join(root, "cases", "sample", "first.md");
  let builds = 0;
  const retry = loadSnapshot(root, initial, { onBuilt: () => { if (++builds === 1) appendFileSync(file, "changed\n"); } });
  assert.equal(builds, 0, "unchanged signature reuses cache");
  appendFileSync(file, "start\n");
  builds = 0;
  const stable = loadSnapshot(root, initial, { onBuilt: () => { if (++builds === 1) appendFileSync(file, "changed\n"); } });
  assert.equal(builds, 2);
  assert.equal(stable.caseCount, 1);
  assert.equal(stable.sig, corpusSignature(root));
  appendFileSync(file, "again\n");
  const fallback = loadSnapshot(root, stable, { onBuilt: () => appendFileSync(file, "move\n") });
  assert.equal(fallback.ix, stable.ix);
  assert.equal(fallback.sig, null);
  assert.match(fallback.warning, /corpus is changing/);
  assert.throws(() => loadSnapshot(root, null, { onBuilt: () => appendFileSync(file, "move\n") }), /corpus is changing; retry/);
});

test("uncommitted corpus files mark the snapshot dirty", t => {
  const root = fixture(t);
  const clean = loadSnapshot(root, null);
  assert.equal(clean.dirty, false);
  writeFileSync(join(root, "cases", "sample", "second.md"), readFileSync(join(root, "cases", "sample", "first.md"), "utf8").replace(/first/g, "second"));
  const dirty = loadSnapshot(root, clean);
  assert.equal(dirty.dirty, true);
  assert.equal(dirty.caseCount, 2);
  git(root, "add", "."); git(root, "commit", "-qm", "second");
  const committed = loadSnapshot(root, dirty);
  assert.equal(committed.dirty, false);
  assert.equal(committed.ix, dirty.ix);
});

test("an unreadable corpus file falls back to the previous index", { skip: process.platform === "win32" && "symlinks need privilege on Windows" }, t => {
  const root = fixture(t);
  const prev = loadSnapshot(root, null);
  symlinkSync("missing-target.md", join(root, "cases", "sample", "ghost.md"));
  const snap = loadSnapshot(root, prev);
  assert.equal(snap.ix, prev.ix);
  assert.equal(snap.sig, null);
  assert.match(snap.warning, /^corpus unreadable: .*serving previous index$/);
  assert.throws(() => loadSnapshot(root, null), /corpus unreadable/);
});
