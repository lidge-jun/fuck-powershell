// Probe rig for the 260911 win-hooks round. Writes fixtures to a temp dir and runs
// them, so every claim in the new cases is measured on this machine rather than asserted.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = mkdtempSync(join(tmpdir(), "fp-probe-"));
const W = (name, text, bom = false) =>
  (writeFileSync(join(ROOT, name), (bom ? "\ufeff" : "") + text), join(ROOT, name));
const run = (exe, args, opts = {}) => {
  const r = spawnSync(exe, args, { encoding: "utf8", windowsHide: true, timeout: 20000, ...opts });
  return {
    code: r.status,
    out: (r.stdout || "").trim().replace(/\s+/g, " ").slice(0, 220),
    err: (r.error ? String(r.error.code || r.error.message) : (r.stderr || "").trim().replace(/\s+/g, " ").slice(0, 220)),
  };
};
const show = (label, r) => console.log(label.padEnd(46) + "code=" + r.code + " | out=" + JSON.stringify(r.out) + " | err=" + JSON.stringify(r.err));

console.log("=== ROOT " + ROOT + " ===");

console.log("\n--- A. REM is not inert ---");
const CRLF = (lines) => lines.join("\r\n") + "\r\n";
show("A1 REM naming %~$PATH:I", run("cmd", ["/c", W("a1.cmd", CRLF(["@echo off", "REM resolved by the %~$PATH:I modifier", "echo MARKER_OK"]))]));
show("A2 REM with & echo",        run("cmd", ["/c", W("a2.cmd", CRLF(["@echo off", "REM use %TEMP%\\foo & echo PWNED", "echo MARKER_OK"]))]));
show("A3 REM with 2>nul",         run("cmd", ["/c", W("a3.cmd", CRLF(["@echo off", "REM redirect 2>nul here", "echo MARKER_OK"]))]));
show("A4 REM with unbalanced quote", run("cmd", ["/c", W("a4.cmd", CRLF(["@echo off", 'REM an unbalanced " quote', "echo MARKER_OK"]))]));
show("A5 REM with a pipe",        run("cmd", ["/c", W("a5.cmd", CRLF(["@echo off", "REM piping a | b here", "echo MARKER_OK"]))]));
show("A6 :: with & echo",         run("cmd", ["/c", W("a6.cmd", CRLF(["@echo off", ":: use %TEMP%\\foo & echo PWNED", "echo MARKER_OK"]))]));

console.log("\n--- B. label position and the BOM ---");
const POLY = CRLF([": << 'CMDBLOCK'", "@echo off", "echo MARKER_OK", "exit /b 0", "CMDBLOCK"]);
show("B1 polyglot, no BOM",     run("cmd", ["/c", W("b1.cmd", POLY)]));
show("B2 polyglot, UTF-8 BOM",  run("cmd", ["/c", W("b2.cmd", POLY, true)]));
show("B3 polyglot, leading space", run("cmd", ["/c", W("b3.cmd", " " + POLY)]));
show("B4 polyglot, leading tab", run("cmd", ["/c", W("b4.cmd", "\t" + POLY)]));
show("B5 goto a label with leading spaces", run("cmd", ["/c", W("b5.cmd", CRLF(["@echo off", "goto tgt", "echo WRONG", "   :tgt", "echo MARKER_OK"]))]));
show("B6 goto a label after a BOM", run("cmd", ["/c", W("b6.cmd", CRLF([":tgt", "@echo off", "echo MARKER_OK"]), true)]));

console.log("\n--- C. PowerShell expression vs command mode ---");
const WHERE = "C:\\Windows\\System32\\where.exe";
for (const [name, exe] of [["5.1", "powershell.exe"], ["7", "pwsh.exe"]]) {
  show("C " + name + ' bare  "<path>" arg', run(exe, ["-NoProfile", "-Command", '"' + WHERE + '" /?']));
  show("C " + name + ' call  & "<path>" arg', run(exe, ["-NoProfile", "-Command", '& "' + WHERE + '" /?']));
  show("C " + name + ' cmd /c "<path>" arg', run(exe, ["-NoProfile", "-Command", 'cmd /c "' + WHERE + '" /?']));
}
show("C cmd  bare \"<path>\" arg", run("cmd", ["/c", '"' + WHERE + '" /?']));

console.log("\n--- D. %* does not follow shift ---");
const d = W("d1.cmd", CRLF(["@echo off", "echo BEFORE_STAR=[%*]", "shift", "echo AFTER_STAR=[%*]", "echo AFTER_1=[%1]"]));
show("D1 shift then %*", run("cmd", ["/c", d, "one", "two", "three"]));

console.log("\n--- E. bash on PATH ---");
show("E1 where bash", run("where.exe", ["bash"]));
show("E2 where bash.exe", run("where.exe", ["bash.exe"]));

console.log("\n--- F. python3 identity ---");
show("F1 where python3", run("where.exe", ["python3"]));
show("F2 where python", run("where.exe", ["python"]));
show("F3 python3 -c ''", run("python3", ["-c", ""]));
show("F4 python -c ''", run("python", ["-c", ""]));

console.log("\n--- G. a no-op body under three interpreters ---");
const bashExit = W("g1", "#!/bin/bash\nexit 0\n");
const shOnly = W("g2", "#!/bin/sh\n");
for (const [n, f] of [["bash-shebang+exit 0", bashExit], ["#!/bin/sh alone", shOnly]]) {
  show("G python  " + n, run("python", [f]));
  show("G node    " + n, run("node", [f]));
}

console.log("\n--- H. MSYS argument conversion ---");
const argvjs = W("h.js", "console.log('ARGV=' + JSON.stringify(process.argv.slice(2)));");
for (const bash of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe"]) {
  const probe = run(bash, ["-c", 'node "' + argvjs.replace(/\\/g, "/") + '" /c /tmp/x //c']);
  if (probe.err !== "ENOENT") {
    show("H1 git bash argv", probe);
    show("H2 with MSYS_NO_PATHCONV", run(bash, ["-c", 'node "' + argvjs.replace(/\\/g, "/") + '" /c /tmp/x //c'], { env: { ...process.env, MSYS_NO_PATHCONV: "1" } }));
  }
}

console.log("\n=== done; cleaning up ===");
try { rmSync(ROOT, { recursive: true, force: true }); } catch {}

