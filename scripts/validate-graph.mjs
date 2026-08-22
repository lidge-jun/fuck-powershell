#!/usr/bin/env bun
// V1-V11 gates over ontology/graph.json (+ concept files). V10 = WARN only.
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const ROOT = join(import.meta.dir, "..");
const g = JSON.parse(readFileSync(join(ROOT, "ontology", "graph.json"), "utf8"));
const TYPES = ["Case","Runtime","Shell","Command","Mechanism","ErrorSignature","Workaround","Environment","Concept"];
const VOCAB = ["affects","invokes","manifests_as","caused_by","mitigated_by","unsafe_fix","related_to","supersedes","requires"];
const DIR = {
  affects: [["Case"],["Runtime","Shell","Environment"]],
  invokes: [["Case"],["Command"]],
  manifests_as: [["Case"],["ErrorSignature"]],
  caused_by: [["Case"],["Mechanism"]],
  mitigated_by: [["Case"],["Workaround"]],
  unsafe_fix: [["Case"],["Workaround"]],
  related_to: [["Case","Concept","Mechanism"],["Case","Concept","Mechanism"]],
  supersedes: [["Workaround","Case"],["Workaround","Case"]],
  requires: [["Workaround"],["Runtime","Shell","Environment"]],
};
const errs = [], warns = [];
const byId = new Map();
for (const n of g.nodes) {
  if (byId.has(n.id)) errs.push("V1 dup id " + n.id);
  byId.set(n.id, n);
  if (!TYPES.includes(n.type)) errs.push("V2 bad type " + n.type + " on " + n.id);
}
for (const e of g.edges) {
  if (!VOCAB.includes(e.rel)) { errs.push("V4 bad rel " + e.rel + " (" + e.src + ")"); continue; }
  const from = byId.get(e.from), to = byId.get(e.to);
  if (!from || !to) { errs.push("V3 dangling " + e.from + " -" + e.rel + "-> " + e.to + " (" + e.src + ")"); continue; }
  const [fromT, toT] = DIR[e.rel];
  if (!fromT.includes(from.type) || !toT.includes(to.type)) errs.push("V5 illegal " + from.type + " -" + e.rel + "-> " + to.type + " (" + e.src + ")");
}
const cases = g.nodes.filter(n => n.type === "Case");
for (const c of cases) {
  const mine = g.edges.filter(e => e.from === c.id);
  if (c.failure !== "silent" && !mine.some(e => e.rel === "manifests_as")) errs.push("V6 no manifests_as: " + c.id + " (failure=" + c.failure + ")");
  if (!mine.some(e => e.rel === "caused_by")) errs.push("V7 no caused_by: " + c.id);
}
// concepts: V8/V9
const CONCEPTS = join(ROOT, "ontology", "concepts");
const unsafeTargets = new Set(g.edges.filter(e => e.rel === "unsafe_fix").map(e => e.to));
for (const f of readdirSync(CONCEPTS).filter(f => f.endsWith(".md"))) {
  const text = readFileSync(join(CONCEPTS, f), "utf8");
  const id = (text.match(/^id:\s*(\S+)/m) ?? [])[1];
  const defM = text.match(/## Definition\r?\n+([\s\S]*?)(\n## |$)/);
  const def = defM ? defM[1].trim() : "";
  if (!def) errs.push("V8 empty Definition: " + f);
  else if (def.length > 400) errs.push("V8 Definition >400 chars: " + f);
  if (unsafeTargets.has(id) && !text.includes("## Why it's unsafe")) errs.push("V9 unsafe target missing rationale: " + id);
}
// V10 warn, V11
const referenced = new Set(g.edges.map(e => e.to));
for (const n of g.nodes) if (n.type !== "Case" && !referenced.has(n.id)) warns.push("V10 unreferenced: " + n.id);
const diskStems = [];
const CASES = join(ROOT, "cases");
for (const cat of readdirSync(CASES, { withFileTypes: true }).filter(d => d.isDirectory()))
  for (const f of readdirSync(join(CASES, cat.name)).filter(f => f.endsWith(".md"))) diskStems.push(basename(f, ".md"));
const graphStems = cases.map(c => c.id.slice(5)).sort();
if (JSON.stringify(graphStems) !== JSON.stringify(diskStems.sort())) errs.push("V11 case set mismatch");

for (const w of warns) console.warn("WARN " + w);
if (errs.length) { for (const e of errs) console.error("FAIL " + e); process.exit(1); }
console.log("validate-graph OK: " + cases.length + " cases, " + g.nodes.length + " nodes, " + g.edges.length + " edges, " + warns.length + " warns");
