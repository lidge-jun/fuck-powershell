// Does Windows run a .sh at all? CASE-07 re-examination.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
const ROOT = mkdtempSync(join(tmpdir(), "fp-sh-"));
const sh = join(ROOT, "hook.sh");
writeFileSync(sh, "#!/bin/bash\necho MARKER_OK\n");
const run = (exe, args, opts={}) => {
  const r = spawnSync(exe, args, { encoding: "utf8", windowsHide: true, timeout: 15000, ...opts });
  return { code: r.status, out: (r.stdout||"").trim().replace(/\s+/g," ").slice(0,180),
           err: (r.error ? String(r.error.code) : (r.stderr||"").trim().replace(/\s+/g," ").slice(0,180)) };
};
const show = (l,r) => console.log(l.padEnd(38)+"code="+r.code+" | out="+JSON.stringify(r.out)+" | err="+JSON.stringify(r.err));
console.log("target: " + sh);
show("CreateProcess direct (spawn)", run(sh, []));
show("cmd /c hook.sh",               run("cmd", ["/c", sh]));
show("cmd /c call hook.sh",          run("cmd", ["/c", "call", sh]));
show("cmd /c start /wait hook.sh",   run("cmd", ["/c", "start", "/wait", sh]));
show("powershell & hook.sh",         run("powershell.exe", ["-NoProfile","-Command", "& '"+sh+"'"]));
show("assoc .sh",                    run("cmd", ["/c", "assoc", ".sh"]));
show("PATHEXT",                      run("cmd", ["/c", "echo %PATHEXT%"]));
show("explicit bash hook.sh",        run("C:\\Program Files\\Git\\bin\\bash.exe", [sh.replace(/\\/g,"/")]));
try { rmSync(ROOT,{recursive:true,force:true}); } catch {}

