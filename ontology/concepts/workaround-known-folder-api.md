---
id: workaround-known-folder-api
type: Workaround
label: "resolve known folders through the registration, not the environment"
---

## Definition

Query SHGetKnownFolderPath with a null token and the default-path flag so the answer comes from the effective token's known-folder registration rather than from USERPROFILE, and treat an empty result as a hard failure at the boundary.
