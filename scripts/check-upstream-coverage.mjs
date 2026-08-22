#!/usr/bin/env bun
// Coverage gate for the upstream mining unit (260828_upstream3).
//
// Unlike the first-party gate, an upstream inventory has two halves: merged
// commits and OPEN ISSUES. Both must be dispositioned, and they are checked
// separately so a full commit table cannot hide an empty issue table.
//
//   bun scripts/check-upstream-coverage.mjs <repo> [unit]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const repo = process.argv[2];
const unit = process.argv[3] ?? "260828_upstream3";
if (!repo) {
  console.error("usage: bun scripts/check-upstream-coverage.mjs <repo> [unit]");
  process.exit(2);
}

const unitDir = join(ROOT, "devlog", unit);
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };

const commitsRaw = read(join(unitDir, "inv", `t1_${repo}.txt`));
const issuesRaw = read(join(unitDir, "inv", `issues_${repo}.txt`));
if (commitsRaw === null || issuesRaw === null) {
  console.error(`COVERAGE: missing inventory for '${repo}' in ${unitDir}/inv`);
  process.exit(2);
}

const commits = commitsRaw.split("\n")
  .map(l => l.split("\t")[0].trim())
  .filter(s => /^[0-9a-f]{40}$/.test(s));
const issues = issuesRaw.split("\n")
  .map(l => l.split("\t")[0].trim())
  .filter(s => /^\d+$/.test(s));

// The decade doc for this repo is whichever unit doc names it. Repo dir names
// and doc slugs differ (hermes-agent vs hermes), so match on a shortened stem.
const stem = repo.split("-")[0];
const docs = readdirSync(unitDir)
  .filter(f => /^\d{3}_.*\.md$/.test(f))
  .filter(f => f.includes(repo) || f.includes(stem));
if (docs.length === 0) {
  console.error(`COVERAGE: no decade doc in ${unitDir} matches repo '${repo}'`);
  process.exit(2);
}
const text = docs.map(f => readFileSync(join(unitDir, f), "utf8")).join("\n");

// Parse DISPOSITION ROWS, not tokens. An earlier version matched any hex token
// anywhere in the doc, which meant a table row could name a SHA while carrying
// no verb at all — and that is exactly how rows claiming NEW for cases nobody
// wrote passed the gate. A row counts only when column 1 is the identifier and
// column 2 opens with a disposition verb.
// HELD is a fourth verb, added after an audit found rows claiming NEW for cases
// nobody wrote. A held mechanism is real, uncovered, and deliberately not
// written yet — recording that is honest, whereas leaving NEW on it is a ledger
// that disagrees with the corpus. Held ids are exempt from the exists-on-disk
// check for exactly that reason.
const ROW = /^\|\s*#?([0-9a-f]{7,40}|\d+)\s*\|\s*(NEW|REF|REJECT|HELD)\b\s*([^|]*)\|/gim;
const commitRows = new Map();
const issueRows = new Map();
// An all-digit token is ambiguous: 19030713 is a valid abbreviated SHA and a
// plausible issue number. Disambiguate on the source marker — an issue row is
// written "#123" — rather than on the character class, or every numeric SHA
// silently lands in the wrong bucket and reads as an uncovered commit.
for (const m of text.matchAll(ROW)) {
  const [full, id, verb, rest] = m;
  const isIssue = full.includes("#");
  (isIssue ? issueRows : commitRows).set(id.toLowerCase(), { verb, rest: rest.trim() });
}

const missingCommits = commits.filter(sha => {
  for (const t of commitRows.keys()) if (sha.startsWith(t)) return false;
  return true;
});
const missingIssues = issues.filter(n => !issueRows.has(n) && !commitRows.has(n));

// A NEW disposition must name a case that exists on disk. A dangling NEW is a
// ledger that disagrees with the corpus, which is worse than an unwritten case
// because it reads as done.
const caseIds = new Set(
  readdirSync(join(ROOT, "cases"), { recursive: true })
    .map(String)
    .filter(f => f.endsWith(".md"))
    .map(f => f.split("/").pop().replace(/\.md$/, "")),
);
const dangling = [];
for (const [id, { verb, rest }] of [...commitRows, ...issueRows]) {
  if (verb !== "NEW" && verb !== "REF") continue;
  // Case ids are kebab-case but not always lowercase (env-path-vs-PATH-casing),
  // so match the whole hyphenated run before any space or punctuation.
  const named = (rest.match(/^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/) ?? [])[1];
  if (named && !caseIds.has(named)) dangling.push(`${id} ${verb} ${named}`);
}

const label = `${repo} (${docs.join(", ")})`;
if (missingCommits.length || missingIssues.length || dangling.length) {
  console.error(`COVERAGE FAIL ${label}: ${missingCommits.length}/${commits.length} commits and ${missingIssues.length}/${issues.length} issues have no disposition row; ${dangling.length} row(s) name a case that does not exist`);
  for (const sha of missingCommits.slice(0, 20)) console.error("  commit " + sha);
  for (const n of missingIssues.slice(0, 20)) console.error("  issue #" + n);
  for (const d of dangling.slice(0, 20)) console.error("  dangling " + d);
  process.exit(1);
}
console.log(`COVERAGE OK ${label}: ${commits.length}/${commits.length} commits, ${issues.length}/${issues.length} issues, all NEW/REF ids exist`);
