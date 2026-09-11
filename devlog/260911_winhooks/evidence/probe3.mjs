// Probes for the two remaining unmeasured claims: the CRLF shebang, and what a
// config loader actually does to a Windows path.
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = mkdtempSync(join(tmpdir(), "fp-probe3-"));
const W = (n, t) => (writeFileSync(join(ROOT, n), t), join(ROOT, n));
const run = (exe, args, opts = {}) => {
  const r = spawnSync(exe, args, { encoding: "utf8", windowsHide: true, timeout: 20000, ...opts });
  return { code: r.status, out: (r.stdout || "").trim().replace(/\s+/g, " ").slice(0, 240),
           err: (r.error ? String(r.error.code) : (r.stderr || "").trim().replace(/\s+/g, " ").slice(0, 240)) };
};
const show = (l, r) => console.log(l.padEnd(40) + "code=" + r.code + " | out=" + JSON.stringify(r.out) + " | err=" + JSON.stringify(r.err));

const BASH = ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe"].find(existsSync);
console.log("=== CRLF in a shebang, executed by " + BASH + " ===");
const lf   = W("lf.sh",   "#!/bin/bash\necho MARKER_OK\n");
const crlf = W("crlf.sh", "#!/bin/bash\r\necho MARKER_OK\r\n");
const p = (f) => f.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (m, d) => "/" + d.toLowerCase());
if (BASH) {
  show("LF shebang",   run(BASH, ["-c", "chmod +x '" + p(lf)   + "'; '" + p(lf)   + "'"]));
  show("CRLF shebang", run(BASH, ["-c", "chmod +x '" + p(crlf) + "'; '" + p(crlf) + "'"]));
  show("CRLF via explicit bash", run(BASH, ["-c", "bash '" + p(crlf) + "'"]));
  // Repo-relative, so the rig runs from any checkout rather than only the one it was
  // written on. fileURLToPath rather than import.meta.dir, which is Bun-only and is
  // undefined under node - the rig has to run under both.
  const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  show("git config core.autocrlf", run("git", ["config", "--get", "core.autocrlf"], { cwd: REPO }));
}

console.log("\n=== a Windows path through three config layers ===");
// Written once as raw characters, then fed to each layer that might eat them.
const raw = "C:" + String.fromCharCode(92) + "Users" + String.fromCharCode(92) + "smsme" + String.fromCharCode(92) + "src";
const asJsonText = '{"p": "' + raw + '"}';
console.log("source bytes        : " + JSON.stringify(asJsonText));
try { console.log("strict JSON.parse   -> " + JSON.stringify(JSON.parse(asJsonText).p)); }
catch (e) { console.log("strict JSON.parse   -> THROWS " + e.message.slice(0, 100)); }

// The same characters written as a JS string literal, so the language's own escape
// layer processes them. \U and \s are not escapes, \b and \s are the interesting ones.
const asJsLiteral = "C:\Users\smsme\src";
console.log("JS string literal   -> " + JSON.stringify(asJsLiteral));

const lenient = asJsonText.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
console.log("re-escaped then JSON-> " + JSON.stringify(JSON.parse(lenient).p));

console.log("\nnode resolving the JS-literal-mangled path:");
try { await import("file:///" + asJsLiteral.replace(/\\/g, "/") + "/index.js"); }
catch (e) { console.log("  -> " + e.code + ": " + String(e.message).split("\n")[0].slice(0, 150)); }

try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
