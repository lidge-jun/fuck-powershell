#!/usr/bin/env bun
// One-shot: generate ontology/concepts/*.md for every id used in ontology-data.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(import.meta.dir, "..");
const DATA = JSON.parse(readFileSync(join(import.meta.dir, "ontology-data.json"), "utf8"));
const DEFS = JSON.parse(readFileSync(join(import.meta.dir, "concept-defs.json"), "utf8"));
const TYPE = { runtime: "Runtime", shell: "Shell", command: "Command", mechanism: "Mechanism", error: "ErrorSignature", workaround: "Workaround", env: "Environment", concept: "Concept" };
const ids = new Set();
const unsafeTargets = new Set();
for (const c of Object.values(DATA)) {
  for (const [k, arr] of Object.entries(c)) {
    for (const id of arr) { ids.add(id); if (k === "unsafe_fix") unsafeTargets.add(id); }
  }
}
const dir = join(ROOT, "ontology", "concepts");
mkdirSync(dir, { recursive: true });
let created = 0, skippedDef = [];
for (const id of [...ids].sort()) {
  const prefix = id.split("-")[0];
  const type = TYPE[prefix];
  if (!type) { console.error("no type for " + id); process.exit(1); }
  const def = DEFS[id];
  if (!def) { skippedDef.push(id); continue; }
  const label = id.replace(/^(runtime|shell|command|mechanism|error|workaround|env|concept)-/, "").replace(/-/g, " ");
  let body = "---\nid: " + id + "\ntype: " + type + "\nlabel: \"" + label + "\"\n---\n\n## Definition\n\n" + def.d + "\n";
  if (unsafeTargets.has(id)) {
    body += "\n## Why it's unsafe\n\n" + (def.u ?? "Tempting fix that trades one failure for a worse one; see citing cases.") + "\n";
  }
  writeFileSync(join(dir, id + ".md"), body);
  created++;
}
console.log("created " + created + " concepts; missing defs: " + JSON.stringify(skippedDef));
