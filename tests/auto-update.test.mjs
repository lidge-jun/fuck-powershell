import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createUpdater } from "../scripts/lib/auto-update.mjs";

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "core.autocrlf=false", "-c", "user.name=t", "-c", "user.email=t@t", "-C", cwd, ...args],
    { encoding: "utf8", windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
}

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "fp-update-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = join(dir, "origin.git");
  const clone = join(dir, "clone");
  const writer = join(dir, "writer");
  git(dir, "init", "--bare", origin);
  git(dir, "clone", origin, clone);
  writeFileSync(join(clone, "README"), "one\n");
  git(clone, "add", "README"); git(clone, "commit", "-m", "seed");
  git(clone, "push", "-u", "origin", "HEAD");
  git(dir, "clone", origin, writer);
  const updater = (extra = {}) => createUpdater({ root: clone, enabled: true, intervalMs: 0,
    stateDir: join(dir, "state"), ...extra });
  const push = () => {
    writeFileSync(join(writer, "README"), "two\n");
    git(writer, "add", "README"); git(writer, "commit", "-m", "remote"); git(writer, "push");
  };
  return { dir, clone, origin, writer, updater, push };
}

test("clean checkout fast-forwards, then reports up-to-date", async (t) => {
  const f = fixture(t); f.push();
  assert.equal(await f.updater().run(), "updated");
  assert.equal(git(f.clone, "rev-parse", "HEAD"), git(f.origin, "rev-parse", "HEAD"));
  assert.equal(await f.updater().run(), "up-to-date");
});

test("dirty checkout does not move HEAD", async (t) => {
  const f = fixture(t); f.push();
  const before = git(f.clone, "rev-parse", "HEAD");
  writeFileSync(join(f.clone, "untracked"), "x");
  assert.equal(await f.updater().run(), "skipped:dirty");
  assert.equal(git(f.clone, "rev-parse", "HEAD"), before);
});

test("diverged checkout is never merged", async (t) => {
  const f = fixture(t); f.push();
  writeFileSync(join(f.clone, "local"), "x");
  git(f.clone, "add", "local"); git(f.clone, "commit", "-m", "local");
  const before = git(f.clone, "rev-parse", "HEAD");
  assert.equal(await f.updater().run(), "skipped:diverged");
  assert.equal(git(f.clone, "rev-parse", "HEAD"), before);
});

test("no upstream and detached HEAD are skipped", async (t) => {
  const f = fixture(t);
  git(f.clone, "switch", "-c", "lonely");
  assert.equal(await f.updater().run(), "skipped:no-upstream");
  git(f.clone, "switch", "--detach");
  assert.equal(await f.updater().run(), "skipped:detached");
});

test("fetch and merge failures leave HEAD unchanged", async (t) => {
  const f = fixture(t); f.push();
  const before = git(f.clone, "rev-parse", "HEAD");
  const real = async (args) => {
    try { return { code: 0, stdout: git(f.clone, ...args) }; }
    catch { return { code: 1, stdout: "" }; }
  };
  assert.equal(await f.updater({ exec: (args) => args[0] === "fetch" ? Promise.resolve({ code: 1, stdout: "" }) : real(args) }).run(), "skipped:fetch-failed");
  assert.equal(await f.updater({ exec: (args) => args[0] === "merge" ? Promise.resolve({ code: 1, stdout: "" }) : real(args) }).run(), "skipped:merge-failed");
  assert.equal(git(f.clone, "rev-parse", "HEAD"), before);
});

test("missing git and other spawn failures are distinct", async (t) => {
  const f = fixture(t);
  assert.equal(await f.updater({ exec: () => Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" })) }).run(), "skipped:no-git");
  const real = async (args) => ({ code: 0, stdout: git(f.clone, ...args) });
  assert.equal(await f.updater({ exec: (args) => args[0] === "status" ? Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" })) : real(args) }).run(), "skipped:git-error");
});

test("busy covers fetch through settlement", async (t) => {
  const f = fixture(t);
  let release;
  let entered;
  const atFetch = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const exec = async (args) => {
    if (args[0] === "fetch") { entered(); await gate; }
    return { code: 0, stdout: git(f.clone, ...args) };
  };
  const updater = f.updater({ exec });
  const pending = updater.run(); await atFetch;
  assert.equal(updater.busy(), true);
  release(); assert.equal(await pending, "up-to-date");
  assert.equal(updater.busy(), false);
});

test("kick obeys throttle and disabled mode", async (t) => {
  const f = fixture(t);
  let calls = 0;
  const real = async (args) => { calls++; return { code: 0, stdout: git(f.clone, ...args) }; };
  const updater = f.updater({ intervalMs: 3600000, now: () => 1000, exec: real });
  assert.equal(await updater.run(), "up-to-date");
  const count = calls;
  updater.kick(); updater.kick();
  assert.equal(calls, count);
  const disabled = f.updater({ enabled: false, stateDir: join(f.dir, "disabled") });
  disabled.kick();
  assert.equal(existsSync(join(f.dir, "disabled")), false);
});
