---
id: workaround-pin-test-userprofile
type: Workaround
label: "pin test userprofile"
---

## Definition

On Windows, set USERPROFILE to the individual test's temporary home while exercising code that calls os.homedir(), then restore the previous value in finally. Keep the override test-local so other suites retain their own home configuration.
