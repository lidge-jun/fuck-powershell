#!/usr/bin/env bun
// Build ontology/graph.json + ontology/INDEX.md from cases/ + ontology/concepts/.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph } from "./lib/fp-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let graph;
try { graph = buildGraph(ROOT); }
catch (error) { console.error(error.message); process.exit(1); }
const { nodes, edges } = graph;
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
