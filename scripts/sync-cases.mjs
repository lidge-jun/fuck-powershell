#!/usr/bin/env bun
// Copy cases/*.md into docs-site/src/content/docs/cases/<category>/<id>.md,
// stripping custom frontmatter keys (Starlight docsSchema rejects unknown keys)
// and rendering them as a badge table at the top of the body.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { parseFrontmatter } from "./lib/frontmatter.mjs";

const ROOT = join(import.meta.dir, "..");
const CASES = join(ROOT, "cases");
const OUT = join(ROOT, "docs-site", "src", "content", "docs", "cases");
rmSync(OUT, { recursive: true, force: true });

for (const f of readdirSync(CASES, { recursive: true }).map(String).filter((f) => f.endsWith(".md"))) {
  const text = readFileSync(join(CASES, f), "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) continue;
  const fm = {};
  let key = null;
  for (const line of m[1].split("\n")) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && key) { (Array.isArray(fm[key]) ? fm[key] : (fm[key] = [])).push(item[1].trim()); continue; }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const raw = kv[2].trim();
    fm[key] = raw === "" ? [] : raw.startsWith("[")
      ? raw.slice(1, -1).split(",").map((s) => s.trim())
      : raw.replace(/^"|"$/g, "");
  }
  // body: drop the duplicated H1 (Starlight renders title from frontmatter)
  const body = m[2].replace(/^\s*# .*\n/, "");
  const refs = (fm.refs ?? []).map((r) => "- <" + r + ">").join("\n");
  const ctxChips = (fm.context ?? [])
    .map((c) => '<span class="badge badge-context">' + c + "</span>")
    .join("");
  const ont = (parseFrontmatter(text) ?? {}).ontology ?? {};
  const mechChips = (Array.isArray(ont.caused_by) ? ont.caused_by : [])
    .map((m) => '<a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#' +
      m.replace("mechanism-", "").replace(/[^a-z0-9-]/g, "") + '">' + m.replace("mechanism-", "") + "</a>")
    .join("");
  const badge =
    '<div class="case-badges">' +
    '<span class="badge badge-version">' + fm.versions + "</span>" +
    '<span class="badge badge-failure-' + fm.failure + '">' + fm.failure + "</span>" +
    ctxChips +
    '<span class="badge badge-meta">' + fm.source + "</span>" +
    '<span class="badge badge-meta">repro: ' + fm.repro + "</span>" +
    mechChips +
    "</div>";
  const out = [
    "---",
    `title: "${String(fm.title).replace(/"/g, '\\"')}"`,
    `description: "${fm.category} landmine — ${fm.failure} (${fm.versions})"`,
    "---",
    "",
    badge,
    "",
    body.trim(),
    "",
    "## Refs",
    "",
    refs,
    "",
  ].join("\n");
  const dir = join(OUT, fm.category);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, basename(f)), out);
  console.log("synced cases/" + fm.category + "/" + basename(f));
}
