#!/usr/bin/env bun
// Generate docs-site ontology pages from ontology/graph.json.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(import.meta.dir, "..");
const g = JSON.parse(readFileSync(join(ROOT, "ontology", "graph.json"), "utf8"));
const OUT = join(ROOT, "docs-site", "src", "content", "docs", "ontology");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const byId = new Map(g.nodes.map(n => [n.id, n]));
const cases = g.nodes.filter(n => n.type === "Case");
const caseLink = (id) => {
  const n = byId.get(id);
  const [, cat, file] = n.file.match(/cases\/([^/]+)\/(.+)\.md/);
  return "[" + id.slice(5) + "](/fuck-powershell/cases/" + cat + "/" + file + "/)";
};
// index
const stats = {};
for (const n of g.nodes) stats[n.type] = (stats[n.type] ?? 0) + 1;
writeFileSync(join(OUT, "index.md"), `---
title: Landmine Ontology
description: The failure graph behind the archive.
---

Every case is annotated with typed edges — what it affects, what it invokes,
which mechanism causes it, what error it manifests as, and which workarounds are
safe or tempting-but-unsafe. The graph powers the [fp lookup engine](/fuck-powershell/skill/).

| type | count |
|---|---|
${Object.entries(stats).map(([t, c]) => "| " + t + " | " + c + " |").join("\n")}

Total: ${g.nodes.length} nodes, ${g.edges.length} edges. Generated from case
frontmatter — see [Mechanisms](/fuck-powershell/ontology/mechanisms/) and
[Error signatures](/fuck-powershell/ontology/errors/).
`);
// mechanisms
let mech = "---\ntitle: Mechanisms\ndescription: Root causes shared across cases.\n---\n\n";
for (const m of g.nodes.filter(n => n.type === "Mechanism").sort((a,b)=>a.id.localeCompare(b.id))) {
  const def = readFileSync(join(ROOT, m.file), "utf8").match(/## Definition\r?\n+([\s\S]*?)(\n## |$)/)?.[1].trim() ?? "";
  const citing = g.edges.filter(e => e.rel === "caused_by" && e.to === m.id).map(e => caseLink(e.from));
  mech += "## " + m.label + "\n\n" + def + "\n\nCases: " + citing.join(" · ") + "\n\n";
}
writeFileSync(join(OUT, "mechanisms.md"), mech);
// errors
let errs = "---\ntitle: Error signatures\ndescription: Symptom-first reverse index.\n---\n\nSaw an error? Find the landmine.\n\n";
for (const er of g.nodes.filter(n => n.type === "ErrorSignature").sort((a,b)=>a.id.localeCompare(b.id))) {
  const citing = g.edges.filter(e => e.rel === "manifests_as" && e.to === er.id).map(e => caseLink(e.from));
  if (!citing.length) continue;
  const def = readFileSync(join(ROOT, er.file), "utf8").match(/## Definition\r?\n+([\s\S]*?)(\n## |$)/)?.[1].trim() ?? "";
  errs += "## " + er.id.replace("error-", "") + "\n\n" + def + "\n\n" + citing.join(" · ") + "\n\n";
}
writeFileSync(join(OUT, "errors.md"), errs);
console.log("ontology pages: index, mechanisms, errors");
