#!/usr/bin/env bun
// One-shot: convert devlog/260824_issues_windows/issue_NN.json into cases/.
// Mapping table from devlog 000_plan.md (issue -> id/category).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "devlog", "260824_issues_windows");
const MAP = {
  12: ["get-content-scalar-collapse", "collections"],
  13: ["ne-filters-instead-of-compares", "collections"],
  14: ["return-does-not-mean-return", "collections"],
  15: ["convertto-json-depth-two", "parsing"],
  16: ["test-path-trailing-whitespace", "env-paths"],
  17: ["start-process-no-lastexitcode", "exit-codes"],
  18: ["culture-comma-decimal-cast", "parsing"],
};
const OLD_MAP = {
  1:  ["spawn-npm-enoent-einval", "aliases"],
  2:  ["windowsapps-alias-eperm", "env-paths"],
  3:  ["tee-object-utf16", "encoding"],
  4:  ["prose-as-unknown-flags", "args-quoting"],
  5:  ["node-path-host-delimiter", "env-paths"],
  6:  ["backslash-quote-ends-span", "args-quoting"],
  7:  ["utf8-bom-still-breaks-grep", "encoding"],
  8:  ["out-string-multiplies-stderr", "streams"],
  9:  ["get-command-where-disagree", "aliases"],
  10: ["dollar-backslash-vars", "args-quoting"],
  11: ["if-nativecmd-truthiness", "exit-codes"],
};
const FAILS = ["silent","hard-error","misleading-error"];
const CTXS = ["interactive","script","ci","agent"];

for (const [n, [id, cat]] of Object.entries(MAP)) {
  const d = JSON.parse(readFileSync(join(SRC, "issue_" + String(n).padStart(2, "0") + ".json"), "utf8"));
  const body = d.body.replace(/\r\n/g, "\n");
  const lines = body.split("\n");
  const header = lines[0];
  const meta = {};
  for (const m of header.matchAll(/\*\*(\w[\w ]*?):\*\*\s*([^·]+)/g)) {
    meta[m[1].trim().toLowerCase()] = m[2].replace(/`/g, "").trim();
  }
  let versions = (meta.versions ?? "both").toLowerCase();
  versions = versions.includes("5.1") && versions.includes("both") ? "5.1"
    : versions.startsWith("5.1") ? "5.1" : versions.startsWith("7") ? "7.x" : "both";
  let failure = (meta.failure ?? "").toLowerCase().trim();
  if (!FAILS.includes(failure)) failure = "silent";
  const context = (meta.context ?? "script").toLowerCase().split(/[,\s]+/).filter(c => CTXS.includes(c));
  // title: strip the "category:" prefix from the issue title
  const title = d.title.replace(/^[a-z-]+:\s*/i, "").replace(/"/g, "'").replace(/\\/g, "");
  // body: drop header line, normalize sections
  let rest = lines.slice(1).join("\n").trim();
  rest = rest.replace(/^## Workaround \(verified\)/m, "## Workaround");
  rest = rest.replace(/^## Relationship to existing cases$/m, "---");
  rest = rest.replace(/^## A related surprise in the same area$/m, "### A related surprise in the same area");
  const out = [
    "---",
    "id: " + id,
    'title: "' + title + '"',
    "category: " + cat,
    'versions: "' + versions + '"',
    "failure: " + failure,
    "context: [" + context.join(", ") + "]",
    "source: first-party",
    "repro: verified",
    "refs:",
    "  - https://github.com/lidge-jun/fuck-powershell/issues/" + n,
    "---",
    "",
    "# " + title,
    "",
    rest,
    "",
  ].join("\n");
  const dir = join(ROOT, "cases", cat);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, id + ".md"), out);
  console.log("issue #" + n + " -> cases/" + cat + "/" + id + ".md");
}
