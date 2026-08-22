#!/usr/bin/env bun
// One-shot: inject ontology frontmatter blocks into cases (data from extraction lanes).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
const DATA = JSON.parse(readFileSync(join(import.meta.dir, "ontology-data.json"), "utf8"));
const CDIR = join(import.meta.dir, "..", "cases");
let injected = 0; const missing = [];
for (const cat of readdirSync(CDIR, { withFileTypes: true }).filter(d => d.isDirectory())) {
  for (const f of readdirSync(join(CDIR, cat.name)).filter(f => f.endsWith(".md"))) {
    const stem = basename(f, ".md");
    const data = DATA[stem];
    if (!data) { missing.push(stem); continue; }
    const p = join(CDIR, cat.name, f);
    let text = readFileSync(p, "utf8");
    if (text.includes("\nontology:")) continue;
    const block = "ontology:\n" + Object.entries(data).map(([k, v]) => "  " + k + ": [" + v.join(", ") + "]").join("\n") + "\n";
    const i = text.indexOf("\n---", 4);
    text = text.slice(0, i) + "\n" + block + text.slice(i + 1);
    writeFileSync(p, text);
    injected++;
  }
}
console.log("injected " + injected + ", missing: " + JSON.stringify(missing));
