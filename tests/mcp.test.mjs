import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, git, startServer } from "./helpers.mjs";

async function withServer(fn, options) {
  const server = startServer(options);
  try { await fn(server); }
  finally { if (!server.child.killed && server.child.exitCode === null) assert.equal(await server.close(), 0); }
}
function tempCorpus() {
  const root = mkdtempSync(join(tmpdir(), "fp-mcp-"));
  for (const path of ["scripts", "cases", "ontology/concepts"]) cpSync(join(ROOT, path), join(root, path), { recursive: true });
  return root;
}
const call = (server, name, args = {}) => server.request("tools/call", { name, arguments: args });

test("modern discovery and deterministic tool list", async () => withServer(async (s) => {
  const discover = (await s.request("server/discover")).result;
  assert.equal(discover.resultType, "complete");
  assert.ok(discover.supportedVersions.includes("2026-07-28"));
  assert.ok(discover.supportedVersions.includes("2025-11-25"));
  assert.equal(discover.ttlMs, 3600000);
  assert.equal(discover.cacheScope, "public");
  assert.equal(discover._meta["io.modelcontextprotocol/serverInfo"].name, "fuck-powershell");
  const first = (await s.request("tools/list")).result;
  assert.deepEqual(first, (await s.request("tools/list")).result);
  assert.deepEqual(first.tools.map((item) => item.name), ["fp_preflight", "fp_search", "fp_errors", "fp_case"]);
  assert.equal(first.ttlMs, 3600000);
  assert.equal(first.cacheScope, "public");
  for (const item of first.tools) assert.deepEqual(item.annotations, { readOnlyHint: true, openWorldHint: false });
}));

test("metadata errors and version negotiation", async () => withServer(async (s) => {
  const missing = await s.request("tools/list", {}, { modern: false });
  assert.equal(missing.error.code, -32602);
  assert.match(missing.error.message, /protocolVersion/);
  const caps = await s.request("tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } }, { modern: false });
  assert.equal(caps.error.code, -32602);
  const unsupported = await s.request("tools/list", {}, { version: "1900-01-01" });
  assert.equal(unsupported.error.code, -32022);
  assert.equal(unsupported.error.data.requested, "1900-01-01");
  assert.ok(unsupported.error.data.supported.includes("2026-07-28"));
  const badType = await s.request("tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": 5 } });
  assert.equal(badType.error.code, -32602);
}));

test("legacy handshake, fallback, ping, and all advertised versions", async () => {
  for (const version of ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]) {
    await withServer(async (s) => {
      for (const supported of ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"])
        assert.equal((await s.request("tools/list", {}, { version: supported })).result.resultType, "complete");
      const init = await s.request("initialize", { protocolVersion: version }, { modern: false });
      assert.equal(init.result.protocolVersion, version);
      s.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      assert.equal((await s.request("tools/list", {}, { modern: false })).result.resultType, undefined);
      assert.deepEqual((await s.request("ping", {}, { modern: false })).result, {});
      assert.equal((await s.request("ping")).error.code, -32601);
    });
  }
  await withServer(async (s) => {
    assert.equal((await s.request("initialize", { protocolVersion: "1999-01-01" }, { modern: false })).result.protocolVersion, "2025-11-25");
  });
});

test("protocol and argument validation", async () => withServer(async (s) => {
  assert.equal((await s.request("foo/bar")).error.code, -32601);
  for (const [name, args, field] of [
    ["fp_nope", {}, "fp_nope"], ["fp_search", {}, "query"],
    ["fp_case", { id: "curl-alias", extra: 1 }, "extra"],
    ["fp_preflight", { operation: "teleport" }, "operation"],
    ["fp_case", { id: "curl-alias", full: "yes" }, "full"],
    ["fp_case", { id: "../etc" }, "id"], ["fp_search", { query: "" }, "query"],
  ]) {
    const response = await call(s, name, args);
    assert.equal(response.error.code, -32602);
    assert.ok(response.error.message.includes(field));
  }
}));

test("tools render compact text and structured content", async () => withServer(async (s) => {
  const preflight = (await call(s, "fp_preflight", { runtime: "node", operation: "spawn", target: "npm" })).result;
  assert.equal(preflight.isError, false);
  assert.equal(preflight.structuredContent.risk, "high");
  assert.match(preflight.content[0].text, /corpus .* · \d+ cases/);
  assert.match(preflight.content[0].text, /spawn-npm-enoent-einval/);
  const search = (await call(s, "fp_search", { query: "iex exit terminal" })).result;
  assert.ok(search.structuredContent.cases.length > 0);
  const first = (await call(s, "fp_errors", { signature: "einval" })).result;
  const second = (await call(s, "fp_errors", { signature: "error-einval" })).result;
  assert.deepEqual(first.structuredContent.cases.map((c) => c.id), second.structuredContent.cases.map((c) => c.id));
  const short = (await call(s, "fp_case", { id: "curl-alias" })).result;
  assert.match(short.content[0].text, /## Symptom/);
  assert.match(short.content[0].text, /## Workaround/);
  assert.doesNotMatch(short.content[0].text, /## Repro/);
  assert.match(short.content[0].text, /\(repro omitted; call with full:true\)$/);
  const source = readFileSync(join(ROOT, "cases", "aliases", "curl-alias.md"), "utf8");
  const frontRefs = [...source.split(/\r?\n---/)[0].matchAll(/^\s+-\s+(https?:\/\/\S+)\s*$/gm)].map((m) => m[1]);
  assert.equal(frontRefs.length, 2);
  assert.deepEqual(short.structuredContent.case.refs, frontRefs);
  const full = (await call(s, "fp_case", { id: "curl-alias", full: true })).result;
  assert.match(full.content[0].text, /## Repro/);
  assert.equal((await call(s, "fp_case", { id: "not-a-case" })).result.isError, true);
}));

test("malformed lines do not stop serving; stdout is JSON-RPC only; EOF exits", async () => withServer(async (s) => {
  assert.equal((await s.raw("{not json")).error.code, -32700);
  for (const value of ["[1]", '"str"']) assert.equal((await s.raw(value)).error.code, -32600);
  for (const value of ['{"jsonrpc":"2.0"}', '{"jsonrpc":"2.0","id":true,"method":"tools/list"}']) {
    const reply = await s.raw(value);
    assert.equal(reply.error.code, -32600);
    assert.equal(reply.id, null);
  }
  assert.ok((await s.request("tools/list")).result.tools.length);
  for (const line of s.lines) assert.equal(JSON.parse(line).jsonrpc, "2.0");
}));

test("corpus additions are visible without restart", async () => {
  const root = tempCorpus();
  await withServer(async (s) => {
    const before = (await call(s, "fp_search", { query: "curl" })).result.structuredContent.freshness.caseCount;
    const source = join(root, "cases", "aliases", "curl-alias.md");
    const corpus = readFileSync(source, "utf8");
    writeFileSync(join(root, "cases", "aliases", "copied-landmine.md"), corpus.replace(/curl-alias/g, "copied-landmine"));
    const after = (await call(s, "fp_search", { query: "curl" })).result.structuredContent.freshness.caseCount;
    assert.equal(after, before + 1);
  }, { root });
});

test("README-only commit updates answer HEAD", async () => {
  const root = tempCorpus();
  git(root, "init"); git(root, "add", "."); git(root, "commit", "-m", "corpus");
  await withServer(async (s) => {
    const first = (await call(s, "fp_search", { query: "curl" })).result.structuredContent.freshness;
    writeFileSync(join(root, "README"), "changed\n");
    git(root, "add", "README"); git(root, "commit", "-m", "readme");
    const reply = (await call(s, "fp_search", { query: "curl" })).result;
    const second = reply.structuredContent.freshness;
    assert.notEqual(second.head, first.head);
    assert.equal(second.caseCount, first.caseCount);
    const sha = git(root, "rev-parse", "--short", "HEAD");
    assert.equal(second.head, sha);
    assert.ok(reply.content[0].text.startsWith(`corpus ${sha} · `));
    assert.equal(second.dirty, undefined);
    const source = readFileSync(join(root, "cases", "aliases", "curl-alias.md"), "utf8");
    writeFileSync(join(root, "cases", "aliases", "uncommitted-landmine.md"), source.replace(/curl-alias/g, "uncommitted-landmine"));
    const dirty = (await call(s, "fp_search", { query: "curl" })).result;
    assert.equal(dirty.structuredContent.freshness.dirty, true);
    assert.ok(dirty.content[0].text.startsWith(`corpus ${sha}+dirty · `));
  }, { root });
});

test("rebuild failure serves previous index; first-call failure is visible", async () => {
  const root = tempCorpus();
  const concept = join(root, "ontology", "concepts", "mechanism-bom-sniffing.md");
  await withServer(async (s) => {
    const before = (await call(s, "fp_search", { query: "curl" })).result;
    writeFileSync(concept, readFileSync(concept, "utf8").replace(/^type:.*$/m, ""));
    const after = (await call(s, "fp_search", { query: "curl" })).result;
    assert.equal(after.isError, false);
    assert.match(after.content[0].text, /warning: corpus rebuild failed/);
    assert.deepEqual(after.structuredContent.cases, before.structuredContent.cases);
  }, { root });
  await withServer(async (s) => {
    const failed = (await call(s, "fp_search", { query: "curl" })).result;
    assert.equal(failed.isError, true);
    assert.match(failed.content[0].text, /mechanism-bom-sniffing/);
  }, { root });
});

test("advertised text makes the tools mandatory for Windows work", async () => withServer(async (s) => {
  const list = (await s.request("tools/list")).result.tools;
  for (const tool of list) {
    assert.ok(tool.title, tool.name + " has a title");
    assert.match(tool.description, /Windows/, tool.name + " description names Windows");
    for (const [field, rule] of Object.entries(tool.inputSchema.properties)) {
      assert.ok(typeof rule.description === "string" && rule.description.length > 0, tool.name + "." + field + " has a description");
    }
  }
  const byName = Object.fromEntries(list.map((tool) => [tool.name, tool]));
  assert.match(byName.fp_preflight.description, /^REQUIRED /);
  assert.match(byName.fp_search.description, /filesystem and process-lifecycle/);
  const discover = (await s.request("server/discover")).result;
  assert.match(discover.instructions, /^MANDATORY /);
  assert.equal(discover._meta["io.modelcontextprotocol/serverInfo"].version, "0.2.0");
  const init = (await s.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }, { modern: false })).result;
  assert.match(init.instructions, /^MANDATORY /);
  assert.equal(init.serverInfo.version, "0.2.0");
}));
