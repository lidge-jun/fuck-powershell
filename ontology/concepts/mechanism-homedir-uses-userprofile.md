---
id: mechanism-homedir-uses-userprofile
type: Mechanism
label: "homedir uses userprofile"
---

## Definition

On Windows, os.homedir() reads USERPROFILE rather than HOME, so a test or process that overrides HOME alone still resolves the real user profile as its home.
