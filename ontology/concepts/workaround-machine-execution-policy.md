---
id: workaround-machine-execution-policy
type: Workaround
label: "machine execution policy"
---

## Definition

Set-ExecutionPolicy Unrestricted at machine scope.

## Why it's unsafe

Permanently weakens the machine's script gate for one install. Scope the override to a single process with -ExecutionPolicy Bypass instead.
