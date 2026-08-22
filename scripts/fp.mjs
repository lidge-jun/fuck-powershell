#!/usr/bin/env bun
// fp — failure-intelligence lookup over the Landmine Ontology.
// Usage:
//   bun scripts/fp.mjs search <text...>
//   bun scripts/fp.mjs preflight --runtime node --operation spawn [--target npm] [--shell 5.1|7] [--json]
//   bun scripts/fp.mjs case <id>
//   bun scripts/fp.mjs errors <signature>
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const GRAPH = join(ROOT, "ontology", "graph.json");
if (!existsSync(GRAPH)) execSync("bun " + join(import.meta.dir, "build-graph.mjs"), { stdio: "ignore" });
const g = JSON.parse(readFileSync(GRAPH, "utf8"));
const byId = new Map(g.nodes.map(n => [n.id, n]));
const caseEdges = new Map();
for (const e of g.edges) (caseEdges.get(e.from) ?? caseEdges.set(e.from, []).get(e.from)).push(e);

const OPERATION_MAP = {
  spawn: ["mechanism-pathext-resolution", "mechanism-cmd-reparse", "mechanism-cmd-bat-spawn-hardening"],
  "env-path": ["mechanism-registry-env-snapshot", "mechanism-path-delimiter", "mechanism-env-casing"],
  encoding: ["mechanism-bom-sniffing", "mechanism-default-encoding"],
  redirect: ["mechanism-stream-wrapping", "mechanism-posix-dev-null", "mechanism-host-vs-pipeline"],
  "exit-code": ["mechanism-exit-code-propagation", "mechanism-output-truthiness"],
  quoting: ["mechanism-native-argv-rebuild", "mechanism-string-interpolation", "mechanism-statement-terminator"],
  install: ["mechanism-execution-policy-gate", "mechanism-registry-env-snapshot", "mechanism-iex-session"],
  ci: [],
};
const RUNTIME_MAP = { node: "runtime-node", bun: "runtime-bun", powershell: "shell-powershell-51", cmd: "shell-cmd" };
const WEIGHT = { invokes: 3, caused_by: 2, manifests_as: 2, affects: 1 };

const [cmd, ...rest] = process.argv.slice(2);

function flags(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { o[args[i].slice(2)] = args[i+1] && !args[i+1].startsWith("--") ? args[++i] : true; }
    else o._.push(args[i]);
  }
  return o;
}
function caseInfo(id) {
  const n = byId.get(id);
  return { id: id.slice(5), title: n.label, file: n.file, category: n.category, failure: n.failure };
}

if (cmd === "search") {
  const q = rest.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  const scored = g.nodes.filter(n => n.type === "Case").map(n => {
    const hay = (n.id + " " + n.label + " " + n.category + " " +
      (caseEdges.get(n.id) ?? []).map(e => e.to).join(" ")).toLowerCase();
    const score = q.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { n, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  for (const { n, score } of scored) console.log(score + "  " + n.id.slice(5) + "  (" + n.file + ")");
  if (!scored.length) console.log("no matches");
} else if (cmd === "preflight") {
  const f = flags(rest);
  const queryNodes = new Set();
  if (f.operation && OPERATION_MAP[f.operation]) OPERATION_MAP[f.operation].forEach(x => queryNodes.add(x));
  if (f.operation === "ci") queryNodes.add("env-actions-runner");
  if (f.runtime && RUNTIME_MAP[f.runtime]) queryNodes.add(RUNTIME_MAP[f.runtime]);
  if (f.runtime === "powershell" && String(f.shell) === "7") { queryNodes.delete("shell-powershell-51"); queryNodes.add("shell-pwsh-7"); }
  if (f.target && byId.has("command-" + f.target)) queryNodes.add("command-" + f.target);
  const results = [];
  for (const n of g.nodes.filter(n => n.type === "Case")) {
    const edges = caseEdges.get(n.id) ?? [];
    let score = 0; const reason = [];
    for (const e of edges) if (queryNodes.has(e.to)) { score += WEIGHT[e.rel] ?? 1; reason.push(e.rel + ":" + e.to); }
    if (f.target && !byId.has("command-" + f.target)) {
      const hay = (n.id + " " + n.label).toLowerCase();
      if (hay.includes(String(f.target).toLowerCase())) { score += 2; reason.push("text:" + f.target); }
    }
    if (score > 0) results.push({ ...caseInfo(n.id), score, reason });
  }
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 6);
  const constraints = [...new Set(top.slice(0, 3).flatMap(r =>
    (caseEdges.get("case:" + r.id) ?? []).filter(e => e.rel === "mitigated_by").map(e => byId.get(e.to)?.label ?? e.to)))];
  const out = { risk: top[0]?.score >= 5 ? "high" : top.length ? "medium" : "low", cases: top, constraints };
  console.log(f.json ? JSON.stringify(out, null, 2) : renderPreflight(out));
} else if (cmd === "case") {
  const id = rest[0];
  const n = byId.get("case:" + id);
  if (!n) { console.error("unknown case " + id); process.exit(1); }
  console.log(readFileSync(join(ROOT, n.file), "utf8"));
} else if (cmd === "errors") {
  const sig = rest[0]?.startsWith("error-") ? rest[0] : "error-" + rest[0];
  const hits = g.edges.filter(e => e.rel === "manifests_as" && e.to === sig).map(e => caseInfo(e.from));
  if (!hits.length) console.log("no cases manifest " + sig);
  for (const h of hits) console.log(h.id + "  (" + h.file + ")");
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
