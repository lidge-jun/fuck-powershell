---
id: path-dot-hijacks-bare-npm
title: "A '.' entry on PATH lets the repo you just opened execute its own npm"
category: env-paths
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/79f923dc5d3751054a0ca59838289409b2520622
---

# A '.' entry on PATH lets the repo you just opened execute its own npm

## Symptom

A tool spawns `npm` on Windows. In most directories it runs the real npm. In
one particular cloned repo, it runs... something else. Nothing errored; the
attacker-controlled `npm.cmd` in the repo root simply won.

## Repro

```
PATH=.;C:\Program Files\nodejs\
cd C:\cloned\evil-repo    # contains npm.cmd
npm --version              # executes .\npm.cmd — the repo's file
```

## Cause

cmd.exe (and resolution that mimics it) walks every PATH entry in order,
including relative entries like `.`. A leading dot entry makes the CURRENT
DIRECTORY the highest-priority tool source — so opening a repository is
equivalent to prepending that repository to PATH.

## Workaround

- When resolving commands for spawn, skip relative PATH entries and the exact
  cwd (but not legitimate home-subtree entries like %AppData%\npm — the
  referenced fix threads that needle).
- Defense in depth: resolve to absolute paths once, then spawn the absolute path.
