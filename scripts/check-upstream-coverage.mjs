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

const hexTokens = new Set(text.match(/\b[0-9a-f]{7,40}\b/g) ?? []);
const issueTokens = new Set((text.match(/#(\d+)\b/g) ?? []).map(t => t.slice(1)));

const missingCommits = commits.filter(sha => {
  for (const t of hexTokens) if (sha.startsWith(t)) return false;
  return true;
});
const missingIssues = issues.filter(n => !issueTokens.has(n));

const label = `${repo} (${docs.join(", ")})`;
if (missingCommits.length || missingIssues.length) {
  console.error(`COVERAGE FAIL ${label}: ${missingCommits.length}/${commits.length} commits and ${missingIssues.length}/${issues.length} issues have no disposition row`);
  for (const sha of missingCommits.slice(0, 20)) console.error("  commit " + sha);
  for (const n of missingIssues.slice(0, 20)) console.error("  issue #" + n);
  process.exit(1);
}
console.log(`COVERAGE OK ${label}: ${commits.length}/${commits.length} commits, ${issues.length}/${issues.length} issues`);
