import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_INTERVAL = 6 * 60 * 60 * 1000;

function defaultStateDir() {
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA || tmpdir(), "fuck-powershell");
  return join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "fuck-powershell");
}

export function createUpdater({ root, enabled = process.env.FP_AUTO_UPDATE === "1",
  intervalMs = Number(process.env.FP_UPDATE_INTERVAL_MS ?? DEFAULT_INTERVAL),
  stateDir = process.env.FP_STATE_DIR || defaultStateDir(), log = () => {},
  now = Date.now, exec } = {}) {
  const stamp = join(stateDir, `update-${createHash("sha256").update(root).digest("hex").slice(0, 16)}.json`);
  const execute = exec || (async (args) => {
    const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
      timeout: 20_000, windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { code: 0, stdout };
  });
  let running = null;
  let inFetchOrMerge = false;
  let last = null;

  function saved() {
    try { return JSON.parse(readFileSync(stamp, "utf8")); } catch { return null; }
  }

  async function run() {
    if (running) return running;
    running = (async () => {
      let outcome;
      async function call(args) {
        try { return await execute(args); }
        catch (error) {
          if (error.code === "ENOENT") return { code: -2, stdout: "" };
          if (typeof error.code === "number") return { code: error.code, stdout: error.stdout || "" };
          return { code: -3, stdout: "" };
        }
      }
      try {
        let result = await call(["symbolic-ref", "-q", "HEAD"]);
        if (result.code === -2) outcome = "skipped:no-git";
        else if (result.code === -3) outcome = "skipped:git-error";
        else if (result.code !== 0) outcome = "skipped:detached";
        if (!outcome) {
          result = await call(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
          if (result.code === -3 || result.code === -2) outcome = "skipped:git-error";
          else if (result.code !== 0) outcome = "skipped:no-upstream";
        }
        if (!outcome) {
          result = await call(["status", "--porcelain"]);
          if (result.code !== 0) outcome = "skipped:git-error";
          else if (result.stdout.trim()) outcome = "skipped:dirty";
        }
        if (!outcome) {
          inFetchOrMerge = true;
          result = await call(["fetch", "--quiet"]);
          if (result.code === -3 || result.code === -2) outcome = "skipped:git-error";
          else if (result.code !== 0) outcome = "skipped:fetch-failed";
        }
        if (!outcome) {
          const local = await call(["rev-parse", "HEAD"]);
          const remote = await call(["rev-parse", "@{u}"]);
          if (local.code !== 0 || remote.code !== 0) outcome = "skipped:git-error";
          else if (local.stdout.trim() === remote.stdout.trim()) outcome = "up-to-date";
        }
        if (!outcome) {
          result = await call(["merge-base", "--is-ancestor", "HEAD", "@{u}"]);
          if (result.code === 1) outcome = "skipped:diverged";
          else if (result.code !== 0) outcome = "skipped:git-error";
        }
        if (!outcome) {
          result = await call(["merge", "--ff-only", "@{u}"]);
          outcome = result.code === 0 ? "updated" : result.code < 0 ? "skipped:git-error" : "skipped:merge-failed";
        }
      } catch (error) {
        log(`[fp-mcp] update error: ${error.message}`);
        outcome = "skipped:git-error";
      } finally {
        inFetchOrMerge = false;
      }
      last = outcome;
      try {
        mkdirSync(stateDir, { recursive: true });
        writeFileSync(stamp, JSON.stringify({ lastAttempt: now(), outcome }));
      } catch (error) { log(`[fp-mcp] update stamp: ${error.message}`); }
      return outcome;
    })();
    try { return await running; } finally { running = null; }
  }

  function kick() {
    if (!enabled || running) return;
    const previous = saved();
    if (previous && now() - previous.lastAttempt < intervalMs) {
      last = previous.outcome;
      return;
    }
    void run().catch((error) => log(`[fp-mcp] update: ${error.message}`));
  }

  return { kick, run, status: () => last ?? saved()?.outcome ?? null, busy: () => inFetchOrMerge };
}
