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
mkdirSync(OUT, { recursive: true });

const CATEGORY_META = {
  "aliases":      { label: "Aliases",      tint: "#5e5ce6", desc: "Commands that are not what they claim to be.", glyph: "M7 8h6a4 4 0 0 1 0 8H9m-2-4h8" },
  "args-quoting": { label: "Quoting",      tint: "#0a84ff", desc: "Arguments shredded between shells.", glyph: "M8 7v4a2 2 0 0 1-2 2m8-6v4a2 2 0 0 1-2 2m6-6v4a2 2 0 0 1-2 2" },
  "streams":      { label: "Streams",      tint: "#64d2ff", desc: "Output that goes places you did not expect.", glyph: "M4 9c2-2 4-2 6 0s4 2 6 0m-12 6c2-2 4-2 6 0s4 2 6 0" },
  "encoding":     { label: "Encoding",     tint: "#30d158", desc: "BOMs, code pages, and corrupted bytes.", glyph: "M6 6l-3 6 3 6m12-12l3 6-3 6M13 5l-2 14" },
  "exit-codes":   { label: "Exit codes",   tint: "#ff9f0a", desc: "Success and failure, misreported.", glyph: "M5 12h8m0 0l-3-3m3 3l-3 3m5-9v12" },
  "versions":     { label: "Versions",     tint: "#bf5af2", desc: "5.1 and 7 are different languages.", glyph: "M12 4v8m0 0l-4 8m4-8l4 8M6 8h12" },
  "env-paths":    { label: "Env & paths",  tint: "#ffd60a", desc: "PATH, registry env, and Win32 path rules.", glyph: "M4 18V8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" },
  "ci-agents":    { label: "CI & agents",  tint: "#ff453a", desc: "Runners and agents assuming POSIX.", glyph: "M8 9l-4 3 4 3m8-6l4 3-4 3m-6 3l4-12" },
  "collections":  { label: "Collections",  tint: "#ac8e68", desc: "Types that change with element count.", glyph: "M4 6h16M4 12h16M4 18h10" },
  "parsing":      { label: "Parsing",      tint: "#6ac4dc", desc: "Serialization and culture-sensitive parsing.", glyph: "M8 4l-4 8 4 8m8-16l4 8-4 8" },
};
const indexEntries = {};

for (const f of readdirSync(CASES, { recursive: true }).map(String).filter((f) => f.endsWith(".md"))) {
  const text = readFileSync(join(CASES, f), "utf8");
  // CRLF-tolerant, for the same reason lint-cases.mjs is: a Windows checkout with
  // core.autocrlf=true hands us \r\n, and an \n-only anchor matches nothing. Here the
  // failure was SILENT rather than loud — every CRLF case fell through this continue,
  // so a sync deleted the whole docs-site case tree and rewrote only the LF files.
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) continue;
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
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
  const NAV_OVERRIDES = {
    "spawn-npm-enoent-einval": "npm spawn: ENOENT & EINVAL",
    "windowstyle-hidden-vs-windowshide": "-WindowStyle vs windowsHide",
    "join-semicolon-splits-startprocess": "Semicolon splits Start-Process",
    "ne-filters-instead-of-compares": "-ne filters collections",
    "get-command-where-disagree": "Get-Command vs where.exe",
    "if-nativecmd-truthiness": "if(native) truthiness",
    "utf8-bom-still-breaks-grep": "utf8 BOM still breaks grep",
    "start-process-no-lastexitcode": "Start-Process exit codes",
    "english-and-not-separator": "'and' is not a separator",
    "backslash-quote-ends-span": "Backslash ends quoted span",
  };
  const id = fm.id;
  const navLabel = NAV_OVERRIDES[id] ?? id.split("-").map(w =>
    /^(enoent|einval|eperm|eftype|bom|utf8|utf16|ps1|ps51|cp949|iex|irm|npm|cmd|ci|json|path|pathext)$/.test(w)
      ? w.toUpperCase().replace("PS51","PS 5.1").replace("UTF8","UTF-8").replace("UTF16","UTF-16")
      : w
  ).join(" ");
  const refs = (fm.refs ?? []).map((r) => "- <" + r + ">").join("\n");
  const ctxChips = (fm.context ?? [])
    .map((c) => '<span class="badge badge-context">' + c + "</span>")
    .join("");
  const fullFm = parseFrontmatter(text) ?? {};
  const ont = fullFm.ontology ?? {};
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
  // At-a-glance card (concept ledger 001)
  const label = (cid) => cid.replace(/^(runtime|shell|command|mechanism|error|workaround|env)-/, "").replace(/-/g, " ");
  const arr = (x) => Array.isArray(x) ? x : [];
  const glanceRows = [];
  if (arr(ont.affects).length) glanceRows.push(["Affects", arr(ont.affects).map(label).join(", ")]);
  const fails = arr(ont.manifests_as).length ? arr(ont.manifests_as).map(l=>label(l).toUpperCase()).join(", ") : fm.failure;
  glanceRows.push(["Fails as", fails]);
  if (arr(ont.caused_by).length) glanceRows.push(["Mechanism", arr(ont.caused_by).map(label).join(", ")]);
  if (arr(ont.mitigated_by).length) glanceRows.push(["Safe fix", '<span class="fix">' + label(ont.mitigated_by[0]) + "</span>"]);
  const glance = '<div class="case-glance">' + glanceRows.map(([k,v]) =>
    '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>").join("") + "</div>";
  const eyebrow = '<p class="case-eyebrow">' + fm.category.replace(/-/g, " ") + " · case</p>";
  const out = [
    "---",
    `title: "${String(fm.title).replace(/"/g, '\\"')}"`,
    `description: "${fm.category} landmine — ${fm.failure} (${fm.versions})"`,
    "sidebar:",
    `  label: "${navLabel.replace(/"/g, "'")}"`,
    "---",
    "",
    eyebrow,
    "",
    badge,
    "",
    glance,
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
  (indexEntries[fm.category] ??= []).push({ id, navLabel, cat: fm.category });
  console.log("synced cases/" + fm.category + "/" + basename(f));
}

// Cases index page (concept ledger 001: category cards)
{
  const base = "/fuck-powershell";
  const cards = Object.entries(CATEGORY_META)
    .filter(([cat]) => indexEntries[cat]?.length)
    .map(([cat, meta]) => {
      const items = indexEntries[cat].sort((a, b) => a.navLabel.localeCompare(b.navLabel));
      const rows = items.map((e) =>
        '<a class="cc-row" href="' + base + "/cases/" + cat + "/" + e.id + '/"><span>' + e.navLabel + '</span><span class="cc-chev">&#8250;</span></a>').join("");
      return '<div class="cc-card">' +
        '<div class="cc-head">' +
        '<span class="cc-glyph" style="background:' + meta.tint + '"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + meta.glyph + '"/></svg></span>' +
        '<div class="cc-title"><strong>' + meta.label + "</strong><span>" + meta.desc + "</span></div>" +
        '<span class="cc-count">' + items.length + "</span></div>" + rows + "</div>";
    }).join("");
  const out = [
    "---",
    'title: "All cases"',
    'description: "Browse every documented landmine by category."',
    "sidebar:",
    '  label: "All cases"',
    "  order: 0",
    "tableOfContents: false",
    "---",
    "",
    "Every case documents a real failure — symptom, repro, cause, workaround — with public citations.",
    "",
    '<div class="cc-grid">' + cards + "</div>",
    "",
  ].join("\n");
  writeFileSync(join(OUT, "index.md"), out);
  console.log("synced cases/index.md (" + Object.keys(indexEntries).length + " categories)");
}
