#!/usr/bin/env bun
// Build ontology/graph.json + ontology/INDEX.md from cases/ + ontology/concepts/.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseFrontmatter } from "./lib/frontmatter.mjs";

const ROOT = join(import.meta.dir, "..");
const CASES = join(ROOT, "cases");
const CONCEPTS = join(ROOT, "ontology", "concepts");
const EDGE_KEYS = ["affects","invokes","manifests_as","caused_by","mitigated_by","unsafe_fix","related_to","supersedes","requires"];

const nodes = [], edges = [];
// concepts first
for (const f of readdirSync(CONCEPTS).filter(f => f.endsWith(".md"))) {
  const fm = parseFrontmatter(readFileSync(join(CONCEPTS, f), "utf8"));
  if (!fm?.id || !fm?.type) { console.error("concept missing id/type: " + f); process.exit(1); }
  nodes.push({ id: fm.id, type: fm.type, label: fm.label ?? fm.id, file: "ontology/concepts/" + f });
}
// cases
for (const cat of readdirSync(CASES, { withFileTypes: true }).filter(d => d.isDirectory())) {
  for (const f of readdirSync(join(CASES, cat.name)).filter(f => f.endsWith(".md"))) {
    const text = readFileSync(join(CASES, cat.name, f), "utf8");
    const fm = parseFrontmatter(text);
    const stem = basename(f, ".md");
    const gid = "case:" + stem;
    nodes.push({ id: gid, type: "Case", label: fm?.title ?? stem, file: "cases/" + cat.name + "/" + f, failure: fm?.failure, category: fm?.category });
    const ont = fm?.ontology ?? {};
    for (const k of EDGE_KEYS) {
      for (const to of (Array.isArray(ont[k]) ? ont[k] : [])) {
        edges.push({ from: gid, rel: k, to, src: "cases/" + cat.name + "/" + f });
      }
    }
  }
}
const graph = { generated: new Date().toISOString(), nodes, edges };
writeFileSync(join(ROOT, "ontology", "graph.json"), JSON.stringify(graph, null, 1));

// INDEX.md
const byType = {};
for (const n of nodes) (byType[n.type] ??= []).push(n);
let idx = "# Ontology index (generated)\n\n";
for (const [t, list] of Object.entries(byType)) idx += "## " + t + " (" + list.length + ")\n\n" + list.map(n => "- " + n.id).join("\n") + "\n\n";
idx += "## Error reverse index\n\n";
const rev = {};
for (const e of edges.filter(e => e.rel === "manifests_as")) (rev[e.to] ??= []).push(e.from);
for (const [err, cs] of Object.entries(rev)) idx += "- " + err + ": " + cs.map(c=>c.slice(5)).join(", ") + "\n";
writeFileSync(join(ROOT, "ontology", "INDEX.md"), idx);
console.log("graph: " + nodes.length + " nodes, " + edges.length + " edges");
