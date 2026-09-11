#!/usr/bin/env bun
// One-shot: devlog/260911_windows-round/issue_NN_*.md -> cases/<category>/<id>.md
// The issue bodies were authored in case shape already; this adds frontmatter and
// drops the metadata header line.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const SRC = import.meta.dir;

const CASES = [
  {
    file: "issue_01_junction-empty-print-name.md",
    id: "junction-empty-print-name",
    category: "env-paths",
    title: "a junction created with an empty print name lists as an empty folder, so a PATH entry through it finds nothing",
    versions: "both", failure: "silent", context: ["interactive", "script", "agent"],
    refs: ["https://github.com/lidge-jun/fuck-powershell/issues/54"],
    ontology: {
      affects: ["shell-powershell-51", "shell-pwsh-7", "shell-cmd", "env-windows", "env-win32-api"],
      invokes: ["command-test-path", "command-get-command"],
      caused_by: ["mechanism-empty-print-name"],
      mitigated_by: ["workaround-resolve-versioned-target"],
    },
  },
  {
    file: "issue_02_timeout-is-not-a-wrapper.md",
    id: "timeout-is-not-a-command-wrapper",
    category: "aliases",
    title: "timeout waits for a keypress instead of bounding a command, and Git's GNU timeout shadows it by PATH order",
    versions: "both", failure: "silent", context: ["script", "ci", "agent"],
    refs: ["https://github.com/lidge-jun/fuck-powershell/issues/55"],
    ontology: {
      affects: ["shell-powershell-51", "shell-pwsh-7", "shell-cmd", "env-windows"],
      invokes: ["command-start-process"],
      caused_by: ["mechanism-alias-shadowing", "mechanism-pathext-resolution"],
      mitigated_by: ["workaround-native-process-deadline", "workaround-kill-process-tree"],
    },
  },
  {
    file: "issue_03_perl-alarm-3584.md",
    id: "perl-alarm-raw-wait-status",
    category: "exit-codes",
    title: "perl's alarm deadline reports the kill as 3584 under Cygwin perl, so a 128+signal check never matches",
    versions: "both", failure: "misleading-error", context: ["script", "ci", "agent"],
    refs: ["https://github.com/lidge-jun/fuck-powershell/issues/56"],
    ontology: {
      affects: ["shell-powershell-51", "shell-pwsh-7", "env-windows"],
      invokes: ["command-start-process"],
      manifests_as: ["error-exit-code-leak"],
      caused_by: ["mechanism-exit-code-propagation"],
      mitigated_by: ["workaround-native-process-deadline", "workaround-passthru-exitcode"],
    },
  },
  {
    file: "issue_04_git-merge-driver-sh-escapes.md",
    id: "git-merge-driver-sh-escapes",
    category: "args-quoting",
    title: "git hands merge.<name>.driver to sh, which eats the backslashes, and the driver that never ran looks like a conflict",
    versions: "both", failure: "silent", context: ["script", "agent"],
    refs: ["https://github.com/lidge-jun/fuck-powershell/issues/57"],
    ontology: {
      affects: ["shell-cmd", "env-windows", "runtime-python"],
      invokes: ["command-git"],
      caused_by: ["mechanism-sh-escape-processing", "mechanism-appexeclink"],
      mitigated_by: ["workaround-normalize-separators-first", "workaround-skip-windowsapps"],
    },
  },
];

for (const c of CASES) {
  const raw = readFileSync(join(SRC, c.file), "utf8").replace(/\r\n/g, "\n");
  // drop the leading "**Category:** ..." metadata line
  const body = raw.split("\n").slice(1).join("\n").trim();
  const fm = ["---", "id: " + c.id, 'title: "' + c.title + '"', "category: " + c.category,
    'versions: "' + c.versions + '"', "failure: " + c.failure,
    "context: [" + c.context.join(", ") + "]", "source: first-party", "repro: verified", "refs:"];
  for (const r of c.refs) fm.push("  - " + r);
  fm.push("ontology:");
  for (const [k, v] of Object.entries(c.ontology)) fm.push("  " + k + ": [" + v.join(", ") + "]");
  fm.push("---", "", "# " + c.title, "", body, "");
  const dir = join(ROOT, "cases", c.category);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, c.id + ".md"), fm.join("\n"), "utf8");
  console.log("wrote cases/" + c.category + "/" + c.id + ".md");
}

