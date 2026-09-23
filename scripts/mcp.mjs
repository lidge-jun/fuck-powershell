#!/usr/bin/env node
import { resolveRoot, loadSnapshot, search, preflight, errors, getCase, parseCaseMarkdown } from "./lib/fp-core.mjs";
import { createUpdater } from "./lib/auto-update.mjs";

const SERVER_INFO = { name: "fuck-powershell", version: "0.1.0" };
const MODERN = ["2026-07-28"];
const LEGACY = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SUPPORTED = [...MODERN, ...LEGACY];
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_CAPS = "io.modelcontextprotocol/clientCapabilities";
const META_SERVER = "io.modelcontextprotocol/serverInfo";
const LIST_TTL_MS = 3_600_000;
const INSTRUCTIONS = "Windows shell/process landmine corpus. Call fp_preflight BEFORE writing code that spawns processes, touches PATH/env, encodings, redirects, exit codes, quoting, installers or Windows CI; read the top case with fp_case. fp_errors maps an error signature (einval, enoent, eperm...) to cases.";
const ROOT = resolveRoot(import.meta.url);
const updater = createUpdater({ root: ROOT, log: (message) => process.stderr.write(`${message}\n`) });
let state = null;
let legacy = false;

function schema(properties, required = []) {
  return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
}
const str = (minLength, maxLength) => ({ type: "string", minLength, maxLength });
const tool = (name, title, description, inputSchema) => Object.freeze({
  name, title, description, inputSchema,
  annotations: { readOnlyHint: true, openWorldHint: false },
});
const TOOLS = Object.freeze([
  tool("fp_preflight", "PowerShell preflight", "Find risks before editing Windows process and shell code.", schema({
    runtime: { type: "string", enum: ["node", "bun", "powershell", "cmd"] },
    operation: { type: "string", enum: ["spawn", "env-path", "encoding", "redirect", "exit-code", "quoting", "install", "ci"] },
    target: str(1, 64), shell: { type: "string", enum: ["5.1", "7"] },
  })),
  tool("fp_search", "Search landmines", "Search case titles and graph connections.", schema({ query: str(1, 200) }, ["query"])),
  tool("fp_errors", "Find error cases", "Find cases by error signature.", schema({ signature: { type: "string", pattern: "^[a-z0-9-]{1,64}$" } }, ["signature"])),
  tool("fp_case", "Read a case", "Read a case summary or full markdown.", schema({
    id: { type: "string", pattern: "^[a-z0-9-]{1,120}$" }, full: { type: "boolean" },
  }, ["id"])),
]);

function send(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function error(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } });
}
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

function validate(name, args) {
  const definition = TOOLS.find((item) => item.name === name);
  if (!definition) throw new Error(`unknown tool ${name}`);
  if (!plain(args)) throw new Error("arguments must be an object");
  const { properties, required = [] } = definition.inputSchema;
  for (const field of required) if (!Object.hasOwn(args, field)) throw new Error(`missing ${field}`);
  for (const [field, value] of Object.entries(args)) {
    const rule = properties[field];
    if (!rule) throw new Error(`unknown field ${field}`);
    if (typeof value !== rule.type) throw new Error(`invalid ${field}: expected ${rule.type}`);
    if (rule.enum && !rule.enum.includes(value)) throw new Error(`invalid ${field}: expected ${rule.enum.join(", ")}`);
    if (rule.minLength && value.length < rule.minLength) throw new Error(`invalid ${field}: too short`);
    if (rule.maxLength && value.length > rule.maxLength) throw new Error(`invalid ${field}: too long`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) throw new Error(`invalid ${field}: pattern mismatch`);
  }
  return args;
}

function corpus() {
  state = loadSnapshot(ROOT, state, { isBusy: updater.busy });
  return state;
}
function freshness(snapshot) {
  const result = { head: snapshot.head, caseCount: snapshot.caseCount, update: updater.status() };
  if (snapshot.dirty) result.dirty = true;
  if (snapshot.checkoutHead !== snapshot.head) result.checkoutHead = snapshot.checkoutHead;
  if (snapshot.warning) result.warning = snapshot.warning;
  return result;
}
function header(snapshot) {
  const head = snapshot.head || "no-git";
  let line = `corpus ${head}${snapshot.dirty ? "+dirty" : ""}`;
  if (snapshot.checkoutHead !== snapshot.head) line += ` (checkout ${snapshot.checkoutHead || "no-git"}, rebuild pending)`;
  line += ` · ${snapshot.caseCount} cases`;
  if (process.env.FP_AUTO_UPDATE === "1") line += ` · update: ${updater.status() || "pending"}`;
  if (snapshot.warning) line += `\nwarning: ${snapshot.warning}`;
  return line;
}
function render(name, data, args) {
  if (name === "fp_preflight") {
    const lines = [`risk: ${data.risk}`];
    for (const item of data.cases) lines.push(`${item.score} ${item.id} — ${item.title} [${item.reason.join(", ")}]`);
    if (data.constraints.length) lines.push("constraints:", ...data.constraints.map((item) => `- ${item}`));
    if (data.cases.length) lines.push(`next: fp_case {"id":"${data.cases[0].id}"}`);
    return lines.join("\n");
  }
  if (name === "fp_search") return data.length ? data.map((item) => `${item.score} ${item.id} — ${item.title}`).join("\n") : "no matches";
  if (name === "fp_errors") return data.cases.length ? data.cases.map((item) => `${item.id} — ${item.title} (${item.category}, ${item.failure})`).join("\n") : `no cases manifest ${data.signature}`;
  if (args.full) return data.markdown;
  const lines = [`# ${data.title}`, `${data.category} · versions ${data.versions ?? "unknown"} · ${data.failure}`];
  for (const section of ["Symptom", "Cause", "Workaround"]) {
    if (data.sections[section]) lines.push(`## ${section}`, data.sections[section]);
  }
  if (data.refs.length) lines.push("refs:", ...data.refs);
  lines.push("(repro omitted; call with full:true)");
  return lines.join("\n");
}
function callTool(params) {
  if (!plain(params) || typeof params.name !== "string") throw new Error("invalid name");
  const args = validate(params.name, params.arguments ?? {});
  updater.kick();
  try { return executeTool(params.name, args); }
  catch (cause) { return { content: [{ type: "text", text: cause.message }], isError: true }; }
}
function executeTool(name, args) {
  const snapshot = corpus();
  let data;
  if (name === "fp_preflight") data = preflight(snapshot.ix, args);
  else if (name === "fp_search") data = search(snapshot.ix, args.query);
  else if (name === "fp_errors") data = errors(snapshot.ix, args.signature);
  else {
    const found = getCase(snapshot.ix, ROOT, args.id);
    if (!found) return { content: [{ type: "text", text: `unknown case ${args.id}; try fp_search` }], isError: true };
    const parsed = parseCaseMarkdown(found.markdown);
    data = { id: found.id, title: parsed.title, file: found.file, category: found.category,
      failure: found.failure, versions: parsed.versions, refs: parsed.refs,
      ...(args.full ? { markdown: found.markdown } : { sections: parsed.sections }) };
  }
  const structuredContent = { freshness: freshness(snapshot), ...(name === "fp_case" ? { case: data } : name === "fp_search" ? { cases: data } : data) };
  return { content: [{ type: "text", text: `${header(snapshot)}\n${render(name, data, args)}` }], structuredContent, isError: false };
}

function dispatch(message) {
  // MCP ids are strings or numbers (never null). Anything that is not a well-formed
  // request or notification gets -32600 with id null, never an echo of a bad id.
  const validId = plain(message) && ["string", "number"].includes(typeof message.id);
  if (!plain(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return error(validId ? message.id : null, -32600, "Invalid Request");
  }
  if (!Object.hasOwn(message, "id")) return;
  if (!validId) return error(null, -32600, "Invalid Request");
  const id = message.id;
  const params = message.params ?? {};
  if (message.method === "initialize") {
    legacy = true;
    const requested = plain(params) ? params.protocolVersion : null;
    return send({ jsonrpc: "2.0", id, result: { protocolVersion: LEGACY.includes(requested) ? requested : LEGACY[0],
      capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS } });
  }
  const meta = plain(params) ? params._meta : null;
  let modern = false;
  if (plain(meta) && Object.hasOwn(meta, META_VERSION)) {
    if (typeof meta[META_VERSION] !== "string" || !plain(meta[META_CAPS])) return error(id, -32602, `Invalid params: _meta requires ${META_VERSION} and ${META_CAPS}`);
    if (!SUPPORTED.includes(meta[META_VERSION])) return error(id, -32022, "Unsupported protocol version", { supported: SUPPORTED, requested: meta[META_VERSION] });
    modern = true;
  } else if (!legacy) {
    return error(id, -32602, `missing _meta.${META_VERSION}; send it (2026-07-28) or initialize first (legacy: 2025-11-25 ...)`);
  }
  let result;
  if (message.method === "server/discover") result = { supportedVersions: SUPPORTED, capabilities: { tools: {} }, instructions: INSTRUCTIONS,
    ttlMs: LIST_TTL_MS, cacheScope: "public", ...(modern ? {} : { serverInfo: SERVER_INFO }) };
  else if (message.method === "tools/list") result = { tools: TOOLS, ttlMs: LIST_TTL_MS, cacheScope: "public" };
  else if (message.method === "ping" && !modern) result = {};
  else if (message.method === "tools/call") {
    try { result = callTool(params); }
    catch (cause) { return error(id, -32602, `Invalid params: ${cause.message}`); }
  } else return error(id, -32601, "Method not found");
  if (modern) result = { resultType: "complete", ...result, _meta: { [META_SERVER]: SERVER_INFO } };
  send({ jsonrpc: "2.0", id, result });
}

process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let cut;
  while ((cut = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, cut).replace(/\r$/, "");
    buffer = buffer.slice(cut + 1);
    if (!line.trim()) continue;
    try { dispatch(JSON.parse(line)); }
    catch (cause) {
      if (cause instanceof SyntaxError) error(null, -32700, "Parse error");
      else process.stderr.write(`[fp-mcp] dispatch: ${cause.message}\n`);
    }
  }
});
process.stdin.on("end", () => process.exit(0));
updater.kick();
