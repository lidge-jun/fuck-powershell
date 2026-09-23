import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./frontmatter.mjs";

export const EDGE_KEYS = ["affects","invokes","manifests_as","caused_by","mitigated_by","unsafe_fix","related_to","supersedes","requires"];
export const OPERATION_MAP = {
  spawn: ["mechanism-pathext-resolution", "mechanism-cmd-reparse", "mechanism-cmd-bat-spawn-hardening"],
  "env-path": ["mechanism-registry-env-snapshot", "mechanism-path-delimiter", "mechanism-env-casing"],
  encoding: ["mechanism-bom-sniffing", "mechanism-default-encoding"],
  redirect: ["mechanism-stream-wrapping", "mechanism-posix-dev-null", "mechanism-host-vs-pipeline"],
  "exit-code": ["mechanism-exit-code-propagation", "mechanism-output-truthiness"],
  quoting: ["mechanism-native-argv-rebuild", "mechanism-string-interpolation", "mechanism-statement-terminator"],
  install: ["mechanism-execution-policy-gate", "mechanism-registry-env-snapshot", "mechanism-iex-session"],
  ci: [],
};
export const RUNTIME_MAP = { node: "runtime-node", bun: "runtime-bun", powershell: "shell-powershell-51", cmd: "shell-cmd" };
export const WEIGHT = { invokes: 3, caused_by: 2, manifests_as: 2, affects: 1 };

export function resolveRoot(fromUrl, env = process.env) {
  if (env.FP_HOME && existsSync(join(env.FP_HOME, "cases"))) return env.FP_HOME;
  return join(dirname(fileURLToPath(fromUrl)), "..");
}

// Directory order is filesystem- and runtime-dependent (Bun returns raw APFS order on
// macOS, Node returns it sorted; ext4 and NTFS differ again), and it decides the order
// of equal-score results. Sort by name so every runtime and OS builds the same graph.
const sortedNames = dir => readdirSync(dir).sort();
const sortedDirs = dir => readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

export function buildGraph(root) {
  const nodes = [], edges = [];
  const concepts = join(root, "ontology", "concepts");
  for (const f of sortedNames(concepts).filter(f => f.endsWith(".md"))) {
    const fm = parseFrontmatter(readFileSync(join(concepts, f), "utf8"));
    if (!fm?.id || !fm?.type) throw new Error("concept missing id/type: " + f);
    nodes.push({ id: fm.id, type: fm.type, label: fm.label ?? fm.id, file: "ontology/concepts/" + f });
  }
  const cases = join(root, "cases");
  for (const category of sortedDirs(cases)) {
    for (const f of sortedNames(join(cases, category)).filter(f => f.endsWith(".md"))) {
      const text = readFileSync(join(cases, category, f), "utf8");
      const fm = parseFrontmatter(text);
      const stem = basename(f, ".md");
      const gid = "case:" + stem;
      const file = "cases/" + category + "/" + f;
      nodes.push({ id: gid, type: "Case", label: fm?.title ?? stem, file, failure: fm?.failure, category: fm?.category });
      const ont = fm?.ontology ?? {};
      for (const k of EDGE_KEYS) {
        for (const to of (Array.isArray(ont[k]) ? ont[k] : [])) edges.push({ from: gid, rel: k, to, src: file });
      }
    }
  }
  return { generated: new Date().toISOString(), nodes, edges };
}

export function createIndex(graph) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const caseEdges = new Map();
  for (const e of graph.edges) (caseEdges.get(e.from) ?? caseEdges.set(e.from, []).get(e.from)).push(e);
  return { graph, byId, caseEdges };
}
function caseInfo(ix, gid) {
  const n = ix.byId.get(gid);
  return { id: gid.slice(5), title: n.label, file: n.file, category: n.category, failure: n.failure };
}
export function search(ix, text) {
  const q = text.toLowerCase().split(/\s+/).filter(Boolean);
  return ix.graph.nodes.filter(n => n.type === "Case").map(n => {
    const hay = (n.id + " " + n.label + " " + n.category + " " +
      (ix.caseEdges.get(n.id) ?? []).map(e => e.to).join(" ")).toLowerCase();
    const score = q.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { n, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
    .map(({ n, score }) => ({ ...caseInfo(ix, n.id), score }));
}
export function preflight(ix, { runtime, operation, target, shell } = {}) {
  const queryNodes = new Set();
  if (operation && OPERATION_MAP[operation]) OPERATION_MAP[operation].forEach(x => queryNodes.add(x));
  if (operation === "ci") queryNodes.add("env-actions-runner");
  if (runtime && RUNTIME_MAP[runtime]) queryNodes.add(RUNTIME_MAP[runtime]);
  if (runtime === "powershell" && String(shell) === "7") { queryNodes.delete("shell-powershell-51"); queryNodes.add("shell-pwsh-7"); }
  if (target && ix.byId.has("command-" + target)) queryNodes.add("command-" + target);
  const targetKind = target && ["runtime-" + target, "shell-" + target].find(x => ix.byId.has(x));
  if (targetKind) queryNodes.add(targetKind);
  const results = [];
  for (const n of ix.graph.nodes.filter(n => n.type === "Case")) {
    const edges = ix.caseEdges.get(n.id) ?? [];
    let score = 0; const reason = [];
    for (const e of edges) if (queryNodes.has(e.to)) { score += WEIGHT[e.rel] ?? 1; reason.push(e.rel + ":" + e.to); }
    if (target && !ix.byId.has("command-" + target)) {
      const t = String(target).toLowerCase();
      const idHit = n.id.slice(5).toLowerCase().split("-").some(tok => tok.replace(/\d+$/, "") === t);
      if (idHit) { score += 3; reason.push("id:" + target); }
      else if (String(n.label ?? "").toLowerCase().includes(t)) { score += 1; reason.push("text:" + target); }
    }
    if (score > 0) results.push({ ...caseInfo(ix, n.id), score, reason });
  }
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 6);
  const constraints = [...new Set(top.slice(0, 3).flatMap(r =>
    (ix.caseEdges.get("case:" + r.id) ?? []).filter(e => e.rel === "mitigated_by").map(e => ix.byId.get(e.to)?.label ?? e.to)))];
  return { risk: top[0]?.score >= 5 ? "high" : top.length ? "medium" : "low", cases: top, constraints };
}
export function errors(ix, sig) {
  const signature = sig?.startsWith("error-") ? sig : "error-" + sig;
  return { signature, cases: ix.graph.edges.filter(e => e.rel === "manifests_as" && e.to === signature).map(e => caseInfo(ix, e.from)) };
}
export function getCase(ix, root, id) {
  const n = ix.byId.get("case:" + id);
  return n ? { ...caseInfo(ix, n.id), markdown: readFileSync(join(root, n.file), "utf8") } : null;
}
export function parseCaseMarkdown(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const frontmatter = parseFrontmatter(normalized);
  const block = normalized.match(/^---\n([\s\S]*?)\n---/);
  const refs = [];
  if (block) {
    let inRefs = false;
    for (const line of block[1].split("\n")) {
      if (/^refs:\s*$/.test(line)) { inRefs = true; continue; }
      if (inRefs && /^[A-Za-z_][\w-]*:/.test(line)) inRefs = false;
      if (inRefs) { const ref = line.match(/^\s+-\s+(\S+)/); if (ref) refs.push(ref[1]); }
    }
  }
  const body = block ? normalized.slice(block[0].length) : normalized;
  const title = body.match(/^# (.+)$/m)?.[1] ?? frontmatter?.title ?? null;
  const sections = {};
  const heading = /^## ([^\n]+)\n/gm;
  const matches = [...body.matchAll(heading)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    sections[matches[i][1].trim()] = body.slice(start, matches[i + 1]?.index ?? body.length).trim();
  }
  return { frontmatter, title, versions: frontmatter?.versions ?? null, refs, sections };
}
function corpusFiles(root) {
  const files = [];
  const cases = join(root, "cases");
  for (const cat of readdirSync(cases, { withFileTypes: true }).filter(d => d.isDirectory())) {
    for (const f of readdirSync(join(cases, cat.name)).filter(f => f.endsWith(".md"))) files.push("cases/" + cat.name + "/" + f);
  }
  for (const f of readdirSync(join(root, "ontology", "concepts")).filter(f => f.endsWith(".md"))) files.push("ontology/concepts/" + f);
  return files.sort();
}
export function corpusSignature(root) {
  return corpusFiles(root).map(file => {
    const s = statSync(join(root, file));
    return file + ":" + s.size + ":" + s.mtimeMs;
  }).join("\n");
}
export function gitHead(root) {
  const out = spawnSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8", timeout: 5000, windowsHide: true });
  return out.status === 0 ? out.stdout.trim() : null;
}
// True when case or concept files differ from HEAD (edited, added, untracked), so the
// answer is not exactly the corpus of the commit it reports. False outside git.
export function gitDirty(root) {
  const out = spawnSync("git", ["-C", root, "status", "--porcelain", "--untracked-files=all", "--", "cases", "ontology/concepts"],
    { encoding: "utf8", timeout: 5000, windowsHide: true });
  return out.status === 0 && out.stdout.trim() !== "";
}
export function loadSnapshot(root, prev, { isBusy = () => false, onBuilt } = {}) {
  const checkoutHead = gitHead(root);
  if (prev && isBusy()) return { ...prev, checkoutHead };
  let sigError = null;
  const readSignature = () => {
    try { return corpusSignature(root); } catch (error) { sigError = error; return null; }
  };
  const fallback = message => {
    if (!prev) throw new Error(message);
    return { ...prev, sig: null, checkoutHead: gitHead(root), warning: message + "; serving previous index" };
  };
  let before = readSignature();
  if (prev && before !== null && before === prev.sig) {
    return { ...prev, head: checkoutHead, checkoutHead, dirty: gitDirty(root), warning: undefined };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    if (before === null) before = readSignature();
    if (before === null) continue;
    const buildHead = gitHead(root);
    let ix;
    try {
      ix = createIndex(buildGraph(root));
      onBuilt?.();
    } catch (error) {
      if (!prev) throw error;
      return fallback("corpus rebuild failed: " + error.message);
    }
    const after = readSignature();
    const endHead = gitHead(root);
    if (after !== null && before === after && buildHead === endHead) {
      return { sig: after, ix, head: buildHead, checkoutHead: endHead, dirty: gitDirty(root),
        caseCount: ix.graph.nodes.filter(n => n.type === "Case").length };
    }
    before = after;
  }
  return fallback(before === null && sigError ? "corpus unreadable: " + sigError.message : "corpus is changing; retry");
}
