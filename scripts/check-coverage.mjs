#!/usr/bin/env bun
// Coverage gate for a mining work-phase.
//
// Compares the full SHAs in devlog/<unit>/inv/win_<repo>.txt against the SHA
// prefixes that appear in that repo's decade-doc disposition table. Exits 1 and
// lists every inventory SHA with no disposition row.
//
//   bun scripts/check-coverage.mjs <repo> [unit]
//
// Prefix matching is deliberate: disposition tables are written with short SHAs
// for readability, so a row matches when the inventory's full SHA starts with any
// hex token of length >= 7 found in the doc.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const repo = process.argv[2];
const unit = process.argv[3] ?? "260827_win5repo";
if (!repo) {
  console.error("usage: bun scripts/check-coverage.mjs <repo> [unit]");
  process.exit(2);
}

const unitDir = join(ROOT, "devlog", unit);
const invPath = join(unitDir, "inv", `win_${repo}.txt`);

let inventory;
try {
  inventory = readFileSync(invPath, "utf8")
    .split("\n")
    .map(l => l.split("\t")[0].trim())
    .filter(s => /^[0-9a-f]{40}$/.test(s));
} catch {
  console.error(`COVERAGE: cannot read inventory ${invPath}`);
  process.exit(2);
}

// The decade doc for this repo is whichever unit doc names it.
const docs = readdirSync(unitDir)
  .filter(f => /^\d{3}_.*\.md$/.test(f))
  .filter(f => f.includes(repo.replace(/-/g, "")) || f.includes(repo));
if (docs.length === 0) {
  console.error(`COVERAGE: no decade doc in ${unitDir} matches repo '${repo}'`);
  process.exit(2);
}

const text = docs.map(f => readFileSync(join(unitDir, f), "utf8")).join("\n");
const tokens = new Set((text.match(/\b[0-9a-f]{7,40}\b/g) ?? []));

const missing = inventory.filter(sha => {
  for (const t of tokens) if (sha.startsWith(t)) return false;
  return true;
});

const label = `${repo} (${docs.join(", ")})`;
if (missing.length) {
  console.error(`COVERAGE FAIL ${label}: ${missing.length}/${inventory.length} SHAs have no disposition row`);
  for (const sha of missing) console.error("  " + sha);
  process.exit(1);
}
console.log(`COVERAGE OK ${label}: ${inventory.length}/${inventory.length} dispositioned`);
