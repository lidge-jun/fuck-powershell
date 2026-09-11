#!/usr/bin/env bun
// Regenerate skills/powershell-landmines/references/<category>.md from cases/.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CASES = join(ROOT, "cases");
const OUT = join(ROOT, "skills", "powershell-landmines", "references");
mkdirSync(OUT, { recursive: true });

const byCat = {};
for (const f of readdirSync(CASES, { recursive: true }).map(String).filter(f => f.endsWith(".md")).sort()) {
  const text = readFileSync(join(CASES, f), "utf8");
  const cat = text.match(/^category:\s*(\S+)/m)?.[1];
  if (!cat) continue;
  (byCat[cat] ??= []).push(text);
}
for (const [cat, texts] of Object.entries(byCat)) {
  // CRLF-tolerant: an \n-only anchor leaves the whole YAML block in place on a Windows
  // checkout, so every reference file shipped the frontmatter it was meant to strip.
  const body = texts.map(t => t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")).join("\n\n---\n\n");
  writeFileSync(join(OUT, cat + ".md"), body);
  console.log("wrote references/" + cat + ".md (" + texts.length + " cases)");
}
