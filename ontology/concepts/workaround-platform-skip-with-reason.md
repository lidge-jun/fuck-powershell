---
id: workaround-platform-skip-with-reason
type: Workaround
label: "platform skip with reason"
---

## Definition

test.skipIf(process.platform === "win32") with a comment naming the platform fact that makes the state under test unreachable there. Honest only when there is genuinely no coverage to lose.

