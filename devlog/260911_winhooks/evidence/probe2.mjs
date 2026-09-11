// Follow-up probes: the first rig mis-quoted the cmd.exe lane, and the PowerShell
// probe used /? which reports the '/' operator rather than the canonical token error.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = mkdtempSync(join(tmpdir(), "fp-probe2-"));
const CRLF = (l) => l.join("\r\n") + "\r\n";
const W = (n, t) => (writeFileSync(join(ROOT, n), t), join(ROOT, n));
const run = (exe, args, opts = {}) => {
  const r = spawnSync(exe, args, { encoding: "utf8", windowsHide: true, timeout: 20000, ...opts });
  return { code: r.status, out: (r.stdout || "").trim().replace(/\s+/g, " ").slice(0, 260),
           err: (r.error ? String(r.error.code) : (r.stderr || "").trim().replace(/\s+/g, " ").slice(0, 260)) };
};
const show = (l, r) => console.log(l.padEnd(44) + "code=" + r.code + " | out=" + JSON.stringify(r.out) + " | err=" + JSON.stringify(r.err));

// A target that accepts a bare word argument and prints it, so the arg is not a switch.
const target = W("echoarg.cmd", CRLF(["@echo off", "echo GOT=[%1]"]));
const q = '"' + target + '"';

console.log("=== the same emitted line under three dispatchers ===");
console.log("line: " + q + " sessionstart");
show("powershell 5.1", run("powershell.exe", ["-NoProfile", "-Command", q + " sessionstart"]));
show("pwsh 7",         run("pwsh.exe",       ["-NoProfile", "-Command", q + " sessionstart"]));
// Route through a .cmd file so no other layer re-quotes the line for us.
const viaCmd = W("via.cmd", CRLF(["@echo off", q + " sessionstart"]));
show("cmd.exe (line inside a .cmd)", run("cmd", ["/c", viaCmd]));

console.log("\n=== and with the cmd /c prefix ===");
console.log("line: cmd /c " + q + " sessionstart");
show("powershell 5.1", run("powershell.exe", ["-NoProfile", "-Command", "cmd /c " + q + " sessionstart"]));
show("pwsh 7",         run("pwsh.exe",       ["-NoProfile", "-Command", "cmd /c " + q + " sessionstart"]));
const viaCmd2 = W("via2.cmd", CRLF(["@echo off", "cmd /c " + q + " sessionstart"]));
show("cmd.exe (line inside a .cmd)", run("cmd", ["/c", viaCmd2]));

console.log("\n=== and with the call operator ===");
show("powershell 5.1 &", run("powershell.exe", ["-NoProfile", "-Command", "& " + q + " sessionstart"]));
show("pwsh 7 &",         run("pwsh.exe",       ["-NoProfile", "-Command", "& " + q + " sessionstart"]));

console.log("\n=== REM: which substitutions survive it ===");
show("REM %TEMP%",        run("cmd", ["/c", W("r1.cmd", CRLF(["@echo off", "REM path is %TEMP%", "echo MARKER_OK"]))]));
show("REM %~dp0",         run("cmd", ["/c", W("r2.cmd", CRLF(["@echo off", "REM dir is %~dp0", "echo MARKER_OK"]))]));
show("REM %~$PATH:I",     run("cmd", ["/c", W("r3.cmd", CRLF(["@echo off", "REM see the %~$PATH:I modifier", "echo MARKER_OK"]))]));
show("REM %~$PATH:I (::)",run("cmd", ["/c", W("r4.cmd", CRLF(["@echo off", ":: see the %~$PATH:I modifier", "echo MARKER_OK"]))]));

console.log("\n=== node with a bash-shebang file named .py vs no suffix ===");
const asPy = W("hook.py", "#!/bin/bash\nexit 0\n");
show("node hook.py", run("node", [asPy]));

try { rmSync(ROOT, { recursive: true, force: true }); } catch {}

