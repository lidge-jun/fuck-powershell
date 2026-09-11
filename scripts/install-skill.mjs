#!/usr/bin/env bun
// Install skills/powershell-landmines into an agent skills directory by COPY.
//
// Copy, never symlink. A symlinked skill breaks the moment the checkout moves,
// and on Windows it needs Developer Mode or elevation to create at all. The
// installed copy is a build artifact: reinstall after every corpus change.
//
//   bun scripts/install-skill.mjs              # install to the default target
//   bun scripts/install-skill.mjs --check      # exit 1 if the copy has drifted
//   bun scripts/install-skill.mjs --target DIR # explicit skills directory
//
// Default target: $CODEX_HOME/skills, else ~/.codex/skills.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";

const ROOT = join(import.meta.dir, "..");
const NAME = "powershell-landmines";
const SRC = join(ROOT, "skills", NAME);

const argv = process.argv.slice(2);
const check = argv.includes("--check");
const targetFlag = argv.indexOf("--target");
const skillsDir = targetFlag !== -1 && argv[targetFlag + 1]
  ? argv[targetFlag + 1]
  : join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills");
const DST = join(skillsDir, NAME);

/** Relative path -> file bytes, for every file under dir. */
function snapshot(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { recursive: true }).map(String)) {
    const abs = join(dir, entry);
    if (!statSync(abs).isFile()) continue;
    out.set(entry.split("\\").join("/"), readFileSync(abs));
  }
  return out;
}

const src = snapshot(SRC);
if (src.size === 0) {
  console.error("no skill files at " + SRC);
  process.exit(1);
}

if (check) {
  const dst = snapshot(DST);
  const drift = [];
  for (const [rel, buf] of src) {
    const other = dst.get(rel);
    if (!other) drift.push("missing: " + rel);
    else if (!buf.equals(other)) drift.push("differs: " + rel);
  }
  for (const rel of dst.keys()) if (!src.has(rel)) drift.push("stale:   " + rel);
  if (drift.length) {
    console.error("skill copy has drifted from " + relative(ROOT, SRC) + ":");
    for (const d of drift) console.error("  " + d);
    console.error("run: bun scripts/install-skill.mjs");
    process.exit(1);
  }
  console.log("skill copy is in sync (" + src.size + " files) at " + DST);
  process.exit(0);
}

// Replace wholesale so removed files do not linger.
if (existsSync(DST)) {
  const marker = join(DST, "SKILL.md");
  if (!existsSync(marker)) {
    console.error("refusing to replace " + DST + ": no SKILL.md, does not look like this skill");
    process.exit(1);
  }
  rmSync(DST, { recursive: true, force: true });
}
for (const [rel, buf] of src) {
  const abs = join(DST, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, buf);
}
console.log("copied " + src.size + " files -> " + DST);
