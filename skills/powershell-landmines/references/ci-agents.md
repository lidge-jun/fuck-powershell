
# GitHub Actions on Windows defaults to PowerShell — your bash-ism dies quietly

## Symptom

A workflow step that works on ubuntu-latest fails on windows-latest with baffling
errors: `&&` chains behave oddly, `export FOO=bar` does nothing, `2>/dev/null`
throws path errors, heredocs are syntax errors. Nothing in the step changed —
only the runner OS.

## Repro

```yaml
jobs:
  win:
    runs-on: windows-latest
    steps:
      - run: export MY_VAR=1 && echo "$MY_VAR" > /dev/null
      # windows-latest default shell is pwsh:
      # 'export' is not recognized / cannot find path 'C:\dev\null'
```

## Cause

On Windows runners the default `run:` shell is `pwsh` (and `shell: powershell`
selects 5.1 — a different runtime again; see the versions category). Every POSIX
idiom in the step body is suddenly PowerShell input. Coding agents make the same
mistake in reverse: they generate bash-flavored one-liners and hand them to a
Windows host whose remote shell is PowerShell. Both referenced commits are
production fixes for this class of failure — one migrating a Windows workflow to
explicit `pwsh` + encoding-safe cmdlets, one auto-translating POSIX null-device
redirects that agents kept emitting.

## Workaround

- Declare the shell per step explicitly: `shell: bash` (Git Bash exists on
  runners) or `shell: pwsh` — never rely on the default.
- Keep Windows steps PowerShell-native; do not paste POSIX one-liners.
- For agents: detect the target shell before generating commands, and load the
  powershell-landmines skill rules (rules 1-2, 7).


---


# VAR=value cmd is not cmd.exe syntax — npm scripts break on Windows

## Symptom

A package.json script like `"test": "NODE_ENV=test node run.js"` works for
every contributor — until the first Windows contributor runs it:
'NODE_ENV' is not recognized as an internal or external command.

## Repro

```
# cmd.exe (npm's default script shell on Windows):
NODE_ENV=test node run.js
# 'NODE_ENV' is not recognized as an internal or external command
```

## Cause

VAR=value cmd is POSIX per-command environment syntax. cmd.exe has no such
form — it tries to execute the literal token NODE_ENV=test as a program. npm
runs scripts through cmd.exe on Windows, so the POSIX prefix silently
platform-locks the script.

## Workaround

- Route env-setting through a tiny Node wrapper (the referenced
  run-with-env.mjs pattern) or cross-env.
- Or set variables inside the Node process; keep package.json scripts
  shell-neutral.


---


# Execution policy blocks your downloaded installer

## Symptom

A user downloads `install.ps1` and runs it. Windows PowerShell refuses:
"running scripts is disabled on this system" (PSSecurityException,
UnauthorizedAccess). The same content pasted into the terminal runs fine —
confusing everyone.

## Repro

```powershell
# Default Windows PowerShell policy is Restricted (client SKUs):
powershell -File .\install.ps1
# File ... cannot be loaded because running scripts is disabled on this system.
```

## Cause

Execution policy gates SCRIPT FILES, not commands: `-File` and `.ps1` dispatch
are blocked under Restricted/AllSigned (and unsigned downloads under
RemoteSigned via Mark-of-the-Web), while in-memory text execution is not. That
asymmetry is why installer one-liners are `irm URL | iex` — piping text into
the session bypasses file policy. It is a distribution constraint, not slop.

## Workaround

- Distribute the documented entrypoint as `irm <url> | iex` (and then follow
  irm-iex-kills-host: the script must `throw`, never `exit`).
- For local runs, `powershell -ExecutionPolicy Bypass -File install.ps1`
  scopes the override to one process — do not change machine policy.
- CI runners set Bypass for `shell: powershell/pwsh` already; this trap bites
  end-user machines, not Actions.


---


# kill -9 on a wedged Windows test run leaves a held fixture directory; the next run reports 22 failures in a file that is green on a clean tree

## Symptom

A full-suite shard on a self-hosted Windows box wedges; you `kill -9` it and move on. The
NEXT run — different runtime, different branch, nothing in common with the killed one except
the machine — fails 22 of 22 cases in `tests/oauth-store-multi.test.ts`, all from the
`beforeEach`:

```
error: EPERM: operation not permitted, rm 'C:\ocxwin\repo\tests\.tmp-oauth-store-multi-test'
      at removeTreeWithRetry (tests/helpers/remove-tree.ts:28:83)
      at tests/oauth-store-multi.test.ts:44          (beforeEach)
(fail) multi-account auth store > legacy single-credential auth.json ... [5274.25ms]
```

Every case takes ~5.2 s — the retry helper's full 50 × 50 ms budget. The symptom matches an
existing corpus case (`async-child-holds-dir-after-stop`: a fire-and-forget `icacls.exe` holds
the directory) precisely enough that it was diagnosed as that, planned as an 18-file migration,
and passed three audit rounds before anyone ran the falsification probe.

## Repro

```bash
# 1. start a long suite run on the box
bun test --isolate tests --shard=3/4 &
# 2. wait until a fixture directory exists under tests/.tmp-*, then kill the run hard
kill -9 <bun pid>
# 3. run any file that uses that fixture path
bun test --isolate tests/oauth-store-multi.test.ts     # → 22 fail, EPERM in beforeEach
# 4. remove the debris by hand and rerun
rm -rf tests/.tmp-oauth-store-multi-test
bun test --isolate tests/oauth-store-multi.test.ts     # → 22 pass, 1.4 s
```

Recreating the debris WITHOUT a killed run behind it also passes, so the directory itself is
not the problem; something the killed run left alive was holding it.

## Cause

`kill -9` on the parent Bun process does not kill what it spawned (`kill-hits-one-pid-or-the-whole-tree`).
Whatever survived kept a handle on the fixture directory, and Windows' mandatory locking then
refused every later delete until that holder went away. The exact holder was never identified
because the directory was deleted before a handle-owner snapshot was taken — and Windows closes
a process's handles at exit, so "the dead process still holds it" is NOT a valid explanation
even though it is the intuitive one.

What made this expensive was not the lock but the diagnosis. The failure had the exact shape
of a documented mechanism, so it was classified instead of measured: the `icacls` code path was
verified REACHABLE and that was taken as proof it was REACHED. A preload that stubbed both
`icacls` runners and logged every invocation showed 22 failures and zero invocations — the
mechanism never ran.

## Workaround

Before any measurement a conclusion will depend on:

```bash
cd <checkout>
ls -d tests/.tmp-* 2>/dev/null        # fixture debris from a previous run? remove it
ps | grep bun                         # survivors from a killed run? kill them first
```

When a held-directory failure appears, take the handle-owner snapshot BEFORE deleting anything
(`handle.exe <path>`, `openfiles /query`, or Resource Monitor); once the directory is gone the
question cannot be answered.

And when a symptom matches a corpus case exactly: write the falsification condition into the
plan before implementing, and run it first. Here that was "stub the runner and count
invocations" — one two-minute probe against roughly three hours of planning built on the wrong
answer. A corpus match is a hypothesis with a good prior, not a diagnosis.


---


# your npm script is a bash one-liner everywhere and a literal filename on Windows, so the release silently ships without its Windows artifact

## Symptom

A `package.json` script that has worked for years fails only on the Windows leg of
a release matrix, and the error names a file nobody wrote:

```
PYTHON: cannot open file D:\a\proj\proj\=$(bash ../scripts/pick-python.sh)
```

The path is your command substitution, verbatim, treated as a filename. Because
the macOS and Linux legs still pass, the release itself reports success and only
the Windows artifact goes missing — sometimes for several versions before anyone
notices.

## Repro

```json
{ "scripts": { "build": "node $(node -p \"'app.js'\")" } }
```

```
PS> npm run build
Error: Cannot find module 'D:\proj\$(node'
```

```
$ npm run build     # macOS / Linux — runs app.js
```

The substitution is neither expanded nor rejected: its literal text becomes an
argument. That is what makes the real-world version confusing, because the
complaint comes from whatever program received the text:

```
PYTHON: cannot open file D:\a\proj\proj\electron\=$(bash ../scripts/pick-python.sh)
```

There `PYTHON="$(bash ...)"` was meant as an environment prefix. Nothing expanded,
so `PYTHON` resolved through PATHEXT to `python.exe` and the remainder of the line
arrived as a filename to open.

## Cause

npm does not run scripts in a shell of your choosing. On POSIX it uses `/bin/sh`;
on Windows it uses cmd.exe. POSIX shell features you use without thinking are
simply absent there:

- `$(...)` command substitution — not expanded, passed through as text.
- single quotes as a quoting mechanism — cmd.exe treats them as literal characters.
- `VAR=value cmd` inline environment prefixes — that one has its own case,
  `cmd-posix-env-prefix`. It compounds with this one: a prefix whose value is a
  substitution fails on both counts at once, which is exactly the release-lane
  failure above.

Which interpreter you get is npm's `script-shell` config, and its Windows default
is cmd.exe specifically — not `%ComSpec%`. Repointing ComSpec at PowerShell does
not change `npm run`; only `script-shell` does. Node's own `shell: true` is the
one that follows ComSpec, which is a different trap in the same neighborhood.

What makes this a release-killer rather than an annoyance is where it lands. The
failing script is usually a per-platform `dist:win` entry that only executes on
the Windows runner, so it cannot fail during local development or in a pull
request that builds one OS.

## Workaround

Move logic out of the script string and into a file the runtime can execute
directly:

```json
{ "scripts": { "build": "node scripts/build.mjs" } }
```

Compute environment variables inside that program rather than prefixing them in
the script line. When a script genuinely must be shell, name the shell explicitly
(`"build": "bash scripts/build.sh"`) and accept the Git-Bash dependency, or set
`script-shell` in `.npmrc` — but note that changes it for every script and every
contributor.

A contract test that walks `scripts` and rejects `$(`, `&&` chains with inline
env, and single-quoted arguments costs ten lines and catches the next one at PR
time instead of release time.

---

`cmd-posix-env-prefix` covers the inline `VAR=value` prefix specifically.
`actions-default-shell` covers the CI runner's default shell. This case is the
package-manager layer between them: the script string you wrote is handed to a
different interpreter based on the host, and `npm run` never says so.


---


# A per-test timeout sized from a 450 ms local run kills a three-child test that takes 8-19 s on windows-latest, then the leftover children obscure the message

## Symptom

One case in a file of six times out on the hosted Windows shard. Three things print, and only
the first is the real story:

```
killed 2 dangling processes
(fail) startup and CLI sync-cache cannot write models_cache while another process owns K [15536.76ms]
  ^ this test timed out after 15000ms.

# Unhandled error between tests
ENOENT: no such file or directory, open '...\ocx-retained-cache-3FtvI4\lock-release'
      at tests/codex-retained-root-serialization.test.ts:215:12     ← the finally
```

Raise that one case's budget and the failure MOVES to the next case in the file
(20 s budget, ran 20.14 s), now with a third artefact: an unhandled
`sync exited before provider barrier (143)` — the killed child's exit surfacing through a
promise nobody was awaiting any more. Locally the whole file runs in 3.5 s and every case is
green, so nothing reproduces on a developer machine.

## Repro

```ts
// Any test that boots real children on a shared hosted runner.
test("three children", async () => {
  const holder = Bun.spawn([process.execPath, "--eval", holdLockScript]);      // boot #1
  await waitForMarker(holder);                                                  // 8-11 s on windows-latest
  const probe = Bun.spawn([process.execPath, "--eval", importServerScript]);   // boot #2
  await probe.exited;
  Bun.spawnSync([process.execPath, "run", "src/cli/index.ts", "sync-cache"]);  // boot #3
  // ...assertions...
}, 15_000);   // ← chosen because it ran in 448 ms on the author's laptop
```

Measured on the same `windows-latest` job class across three consecutive runs, the SAME first
case took 15.5 s (timeout), 18.7 s, and 8.5 s. A 2× spread on identical work is normal there.

## Cause

Three independent things stack:

1. **The budget measured the wrong machine.** A `bun --eval` child that imports a large module
   graph boots in ~150 ms locally and 8-11 s on a windows-latest runner that is also running
   three sibling Bun pools. Sizing to the local number is the classic error; the repository's
   own `test-budget.ts` names it and it still happened.
2. **Timeouts leave children behind.** Bun's per-test timeout aborts the test body but does not
   reap what the body spawned. "killed N dangling processes" is Bun cleaning up at the end,
   after `afterEach` has already run — which is what produces the next artefact.
3. **Teardown ran against the wrong world.** `afterEach` removed the sandbox root while the
   timed-out test's `finally` was still queued; the `finally` then wrote a release marker into
   a directory that no longer existed (ENOENT). And a `Promise.race` whose losing branch was a
   rejecting `child.exited.then(...)` stayed pending after the barrier won, so the later kill
   rejected it with nobody awaiting — an "unhandled error between tests".

Together they turn one slow boot into three error messages, none of which say "the budget is
too small for this runner".

## Workaround

Fix the class, not the case, and make teardown own the children.

```ts
// 1. Budget from the repository's named constant, not a number.
//    SPAWN_BUDGET_MS is documented as "real child process" and is the same category
//    for every case in this file — budgeting only the one that failed moved the failure.
}, SPAWN_BUDGET_MS);

// 2. Register every spawn on the fixture and reap BEFORE deleting its root.
async function teardownSandbox(s: Sandbox) {
  for (const m of s.releaseMarkers) { try { writeFileSync(m, "release"); } catch {} }
  for (const c of s.children) if (c.exitCode === null) c.kill();
  await Promise.all([...s.children].map(c => c.exited));   // then, and only then, rmSync
}
afterEach(async () => { for (const s of sandboxes.splice(0)) { await teardownSandbox(s); removeTreeWithRetry(s.root); } });

// 3. Detach the losing race branch so a later kill cannot become an unhandled rejection.
const exitedEarly = child.exited.then(async code => { throw new Error(`exited before barrier (${code})`); });
exitedEarly.catch(() => undefined);          // attach NOW, not in a finally
await Promise.race([barrier, exitedEarly]);
```

Before raising any budget, run the ablation the budget file demands: disable the behaviour the
test guards and confirm the case goes red. Here a one-token change (`BEGIN IMMEDIATE` →
`BEGIN` in the lock) turned `expect(existsSync(cachePath)).toBe(false)` red, so the wait was
intrinsic and the case was not vacuous.

Verify the teardown half with a probe, not by reading: insert a 5 s sleep after the barrier
under a 3 s budget. The original reports the timeout PLUS the unhandled 143; the fixed version
reports the timeout alone. Two intermediate attempts (resolve-to-Error; `catch` in a
`finally`) still failed that probe — the handler must be attached before the race, because a
rejection that fires between the race settling and a later `catch` is already unhandled.

Raising only the one failing case is the unsafe fix: on a runner with 2× variance the next
case is simply the next one over the line, and each round costs a 25-minute CI cycle.

## Counterexample: expensive setup is not an intrinsic wait

The quota-reset claim-ceiling test in Windows run 33941712300 took 99.26 seconds
against a 60-second budget. Its loop attempted 2,000 claims, but the assertion
was about a map cap of 1,024, not about a thousand successful durable writes.
Precisely 1,024 successful insertions persist during that setup; later
furthest-deadline newcomers are evicted before persistence. The writer performs
synchronous atomic persistence and Windows ACL work. Do not call this measured
fsync overhead without a trace identifying fsync.

PR #3610 seeds 1,023 valid live records, then performs real insertions that reach
and exceed the cap. It checks exact count, eviction victim, persisted contents,
rehydration, and rejection of a furthest-deadline newcomer. Only two production
writes remain. Removing insertion pruning makes this fixture fail with 1,025
instead of 1,024; restoring it passes. No cap, timeout, durability, or ACL policy
is weakened. Seed ordinary setup, but still cross the behavior's boundary through
the public operation, and prove the test fails when that behavior is removed.

## An outer budget cannot repair a shorter readiness deadline

OpenCodex's native-profile startup fixture documented10–18second Windows child
boots but used a15-second generic deadline while waiting for the real port.
Twelve fresh process scenarios also shared one120-second test. Run33945431119
failed readiness before that aggregate test budget was exhausted.

A controlled local fault delayed port publication16seconds. The old waiter
failed at15.0seconds with the child still running; cleanup observed a healthy
exit0 and port publication at16.2seconds. Using the existing intrinsic spawn
budget passed the same fault and all admission/convergence assertions. This is
a test-harness boundary proof, not a claim that an unexplained Windows kernel
stall was reproduced locally.

PR #3629 makes each scenario an independently budgeted test, retains the whole
scenario matrix, drains both child streams immediately, detects early exit,
and retains primary plus cleanup errors. A forced early failure is reported
in0.26seconds instead of masquerading as a45-second readiness timeout. A forced
shutdown stall is killed/joined within its10-second cleanup bound; the combined
readiness/cleanup fault retains both errors. Disabling the actual native-main
gate still turns the pre-recovery request into200 and fails the assertion.

Use operation-specific bounds, preserve their ordering, and measure the stage
that expired. Never assume that a generous outer test timeout can compensate
for an inner deadline that rejects a healthy child first.
