#!/usr/bin/env bun
// Lint cases/*.md against the schema in README.md. Exit 1 on any violation.
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

const CASES_DIR = join(import.meta.dir, "..", "cases");
const CATEGORIES = ["aliases","args-quoting","streams","encoding","exit-codes","versions","env-paths","ci-agents","collections","parsing"];
const VERSIONS = ["5.1","7.x","both"];
const FAILURES = ["silent","hard-error","misleading-error"];
const CONTEXTS = ["interactive","script","ci","agent"];
const SOURCES = ["first-party","third-party"];
const REPROS = ["verified","historical"];
const SECTIONS = ["## Symptom","## Repro","## Cause","## Workaround"];

function parseFrontmatter(text, file) {
  // CRLF-tolerant: a Windows checkout with core.autocrlf=true hands us \r\n, and a
  // \n-only anchor here reported every case as "missing frontmatter" — a vacuous
  // global failure that looked like a corrupt corpus.
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { error: "missing frontmatter" };
  const fm = {};
  let currentKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && currentKey) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const raw = kv[2].trim();
    if (raw === "") { fm[currentKey] = []; continue; }
    if (raw.startsWith("[")) {
      fm[currentKey] = raw.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
    } else {
      fm[currentKey] = raw.replace(/^"|"$/g, "");
      // reject unquoted numeric scalars for versions (YAML float trap)
      if (currentKey === "versions" && /^[0-9.]+$/.test(raw)) {
        fm.__versionsUnquoted = true;
      }
    }
  }
  return fm;
}

const errors = [];
const ids = new Set();
const files = readdirSync(CASES_DIR, { recursive: true })
  .map(String)
  .filter(f => f.endsWith(".md"));
for (const f of files) {
  const text = readFileSync(join(CASES_DIR, f), "utf8");
  const fm = parseFrontmatter(text, f);
  const err = (msg) => errors.push(f + ": " + msg);
  if (fm.error) { err(fm.error); continue; }
  const stem = basename(f, ".md");
  if (fm.id !== stem) err("id '" + fm.id + "' != filename stem '" + stem + "'");
  // readdirSync({recursive:true}) yields the host separator, so on Windows this is
  // "parsing\\x.md". Normalize before any path reasoning or every case reads as
  // sitting in the cases/ root.
  const rel = f.split("\\").join("/");
  const dir = rel.includes("/") ? rel.split("/")[0] : null;
  if (dir && dir !== fm.category) err("folder '" + dir + "' != category '" + fm.category + "'");
  if (!dir) err("case must live in cases/<category>/, not cases/ root");
  if (ids.has(fm.id)) err("duplicate id"); ids.add(fm.id);
  if (!fm.title) err("missing title");
  if (!CATEGORIES.includes(fm.category)) err("bad category: " + fm.category);
  if (fm.__versionsUnquoted) err("versions must be a quoted string");
  if (!VERSIONS.includes(fm.versions)) err("bad versions: " + fm.versions);
  if (!FAILURES.includes(fm.failure)) err("bad failure: " + fm.failure);
  if (!Array.isArray(fm.context) || fm.context.length === 0 ||
      !fm.context.every(c => CONTEXTS.includes(c))) err("bad context: " + JSON.stringify(fm.context));
  if (!SOURCES.includes(fm.source)) err("bad source: " + fm.source);
  if (!REPROS.includes(fm.repro)) err("bad repro: " + fm.repro);
  const refs = Array.isArray(fm.refs) ? fm.refs : [];
  if (refs.length === 0) err("refs must have at least one public URL");
  // A third-party case must point at evidence someone else can check. Three
  // shapes qualify, and they fail differently rather than one being weaker:
  //   - a commit or PR: someone hit the wall and fixed it
  //   - an issue: someone hit the wall and it is still there, which for a
  //     lookup surface is at least as useful as a fix
  //   - vendor documentation: the behavior is specified, and no commit in
  //     reach demonstrates it (MAX_PATH, reserved device names)
  // Citing an unrelated commit to satisfy this rule is worse than citing any of
  // the three, which is why the rule lists them explicitly.
  const hasCommitOrPr = refs.some(r => /github\.com\/[^/]+\/[^/]+\/(commit|pull)\//.test(r));
  const hasIssue = refs.some(r => /github\.com\/[^/]+\/[^/]+\/issues\//.test(r)
                              && !/lidge-jun\/fuck-powershell/.test(r));
  const hasVendorDoc = refs.some(r => /^https:\/\/(learn|docs)\.microsoft\.com\//.test(r)
                                   || /^https:\/\/docs\.python\.org\//.test(r)
                                   || /^https:\/\/nodejs\.org\//.test(r));
  if (fm.source === "third-party" && !hasCommitOrPr && !hasIssue && !hasVendorDoc)
    err("third-party case requires a commit, PR, issue, or authoritative vendor doc URL");
  // An OPEN ISSUE is a report, not a verified mechanism. When it is the only
  // evidence, the case needs a second primary source — vendor docs, runtime
  // source, or a captured transcript — because an audit found a case whose Cause
  // was inherited wholesale from an unverified issue body.
  if (fm.source === "third-party" && hasIssue && !hasCommitOrPr && !hasVendorDoc
      && !text.includes("## Verification note"))
    err("issue-only third-party case needs a second primary source or a '## Verification note'");
  for (const s of SECTIONS) if (!text.includes(s)) err("missing section " + s);
}

if (errors.length) {
  for (const e of errors) console.error("LINT " + e);
  process.exit(1);
}
console.log(files.length + " cases OK");
