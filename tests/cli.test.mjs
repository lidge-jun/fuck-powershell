import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = process.env.FP_MCP_RUNTIME || process.execPath;
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "fp-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "ontology"));
  cpSync(join(SOURCE, "scripts"), join(root, "scripts"), { recursive: true });
  cpSync(join(SOURCE, "cases"), join(root, "cases"), { recursive: true });
  cpSync(join(SOURCE, "ontology", "concepts"), join(root, "ontology", "concepts"), { recursive: true });
  return root;
}
function run(root, ...args) {
  return spawnSync(RUNTIME, [join(root, "scripts", "fp.mjs"), ...args], { encoding: "utf8", cwd: root, windowsHide: true });
}
test("preflight JSON has the documented high risk", t => {
  const root = fixture(t);
  const r = run(root, "preflight", "--runtime", "node", "--operation", "spawn", "--target", "npm", "--json");
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.risk, "high");
  assert.ok(out.cases.some(c => c.id === "spawn-npm-enoent-einval"));
});
test("unknown case, usage and unknown command preserve exit behavior", t => {
  const root = fixture(t);
  const unknown = run(root, "case", "not-a-case");
  assert.equal(unknown.status, 1);
  assert.equal(unknown.stderr, "unknown case not-a-case\n");
  const usage = run(root);
  assert.equal(usage.status, 0);
  assert.equal(usage.stdout, "usage: fp <search|preflight|case|errors> ...\n");
  const bogus = run(root, "bogus");
  assert.equal(bogus.status, 1);
  assert.equal(bogus.stdout, usage.stdout);
});
