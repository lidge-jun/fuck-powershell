import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const RUNTIME = process.env.FP_MCP_RUNTIME || process.execPath;
const META = { "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": { name: "fp-test", version: "1" } };

export function git(cwd, ...args) {
  return execFileSync("git", ["-c", "core.autocrlf=false", "-c", "user.name=t", "-c", "user.email=t@t", "-C", cwd, ...args],
    { encoding: "utf8", windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
}

export function startServer({ env = {}, root = ROOT } = {}) {
  const child = spawn(RUNTIME, [join(root, "scripts", "mcp.mjs")], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, FP_AUTO_UPDATE: "0", ...env },
  });
  const lines = [];
  const waiting = new Map();
  let nextId = 1;
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let cut;
    while ((cut = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      lines.push(line);
      let value;
      try { value = JSON.parse(line); } catch { continue; }
      const key = value.id === null ? "null" : String(value.id);
      const pending = waiting.get(key);
      if (pending) { waiting.delete(key); clearTimeout(pending.timer); pending.resolve(value); }
    }
  });
  function awaitId(id) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(String(id)); reject(new Error(`timeout waiting for ${id}`)); }, 5000);
      waiting.set(String(id), { resolve, timer });
    });
  }
  function raw(line, id = "null") {
    const pending = awaitId(id);
    child.stdin.write(`${line}\n`);
    return pending;
  }
  function request(method, params = {}, { modern = true, version = "2026-07-28" } = {}) {
    const id = nextId++;
    const sent = modern ? { ...params, _meta: { ...META, "io.modelcontextprotocol/protocolVersion": version, ...(params._meta || {}) } } : params;
    return raw(JSON.stringify({ jsonrpc: "2.0", id, method, params: sent }), id);
  }
  function close() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error("server did not exit on EOF")); }, 5000);
      child.once("exit", (code) => {
        clearTimeout(timer);
        // stdio rule: every stdout line of the whole session must be a JSON-RPC message.
        const bad = lines.find((line) => { try { return JSON.parse(line).jsonrpc !== "2.0"; } catch { return true; } });
        if (bad !== undefined) reject(new Error(`non JSON-RPC stdout line: ${bad}`));
        else resolve(code);
      });
      child.stdin.end();
    });
  }
  return { child, lines, request, raw, close };
}
