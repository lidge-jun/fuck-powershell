#!/usr/bin/env bun
// fp — failure-intelligence lookup over the Landmine Ontology.
// Usage:
//   bun scripts/fp.mjs search <text...>
//   bun scripts/fp.mjs preflight --runtime node --operation spawn [--target npm] [--shell 5.1|7] [--json]
//   bun scripts/fp.mjs case <id>
//   bun scripts/fp.mjs errors <signature>
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, createIndex, search, preflight, errors, getCase } from "./lib/fp-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ix = createIndex(buildGraph(ROOT));
const [cmd, ...rest] = process.argv.slice(2);

function flags(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { o[args[i].slice(2)] = args[i+1] && !args[i+1].startsWith("--") ? args[++i] : true; }
    else o._.push(args[i]);
  }
  return o;
}

if (cmd === "search") {
  const hits = search(ix, rest.join(" "));
  for (const h of hits) console.log(h.score + "  " + h.id + "  (" + h.file + ")");
  if (!hits.length) console.log("no matches");
} else if (cmd === "preflight") {
  const f = flags(rest);
  const out = preflight(ix, f);
  console.log(f.json ? JSON.stringify(out, null, 2) : renderPreflight(out));
} else if (cmd === "case") {
  const id = rest[0];
  const found = getCase(ix, ROOT, id);
  if (!found) { console.error("unknown case " + id); process.exit(1); }
  console.log(found.markdown);
} else if (cmd === "errors") {
  const result = errors(ix, rest[0]);
  if (!result.cases.length) console.log("no cases manifest " + result.signature);
  for (const h of result.cases) console.log(h.id + "  (" + h.file + ")");
} else {
  console.log("usage: fp <search|preflight|case|errors> ...");
  process.exit(cmd ? 1 : 0);
}
function renderPreflight(o) {
  let s = "risk: " + o.risk + "\n";
  for (const c of o.cases) s += "  " + String(c.score).padStart(2) + "  " + c.id + "  [" + c.reason.join(", ") + "]\n";
  if (o.constraints.length) s += "constraints:\n" + o.constraints.map(c => "  - " + c).join("\n");
  return s;
}
